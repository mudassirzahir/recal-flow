import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { SERVER_CONFIG } from '../config.ts';
import { consumeQuota, getQuotaStatus } from '../middleware/quota.ts';
import {
  buildOfflineAutoLinks,
  buildOfflineScenario,
  evaluateConceptOffline,
  extractKeyTokens
} from '../services/offlineFallback.ts';

function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function withAiTimeout<T>(promise: Promise<T>, timeoutMs = 14000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI request timed out')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const geminiRouter = Router();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

geminiRouter.get('/api/gemini/quota', (req, res) => {
  const status = getQuotaStatus(req);
  res.json({
    remaining: status.remaining,
    limit: status.limit,
    resetAt: status.resetAt,
    isConfigured: status.isConfigured
  });
});

geminiRouter.post('/api/gemini/neuro-categorize', async (req, res) => {
  const rawTitle = typeof req.body?.title === 'string' ? req.body.title.slice(0, 300) : '';
  const rawContent = typeof req.body?.content === 'string' ? req.body.content.slice(0, 5000) : '';

  if (!rawTitle && !rawContent) {
    res.status(400).json({ error: 'Title or content is required' });
    return;
  }

  const quotaCheck = consumeQuota(req);
  if (!quotaCheck.allowed || !process.env.GEMINI_API_KEY) {
    res.json({
      brainRegion: 'hippocampus',
      category: 'general',
      summary: (rawContent || rawTitle).slice(0, 110),
      tags: extractKeyTokens(`${rawTitle} ${rawContent}`).slice(0, 4),
      suggestedCodeSnippet: '',
      mode: 'offline-fallback',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
    return;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Organize this quick everyday learning journal entry for RecallFlow (for any learner: books, science, history, habits, work, or tech).
Title: "${rawTitle}"
Details: "${rawContent}"

Return JSON with:
- brainRegion: "hippocampus"
- category: one of ["general", "psychology", "insight", "todos", "webdev"]
- summary: crisp 1-sentence memory hook in plain, friendly everyday language
- tags: array of 2-4 short lowercase tags
- suggestedCodeSnippet: short 1-sentence real-world example, quote, or analogy if helpful (do NOT assume programming/code unless the user explicitly wrote about code)`;

    const response = await withAiTimeout(
      ai.models.generateContent({
        model: SERVER_CONFIG.aiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brainRegion: { type: Type.STRING },
              category: { type: Type.STRING },
              summary: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedCodeSnippet: { type: Type.STRING }
            },
            required: ['brainRegion', 'category', 'summary', 'tags']
          }
        }
      })
    );

    const result = safeParseJson<Record<string, unknown>>(response.text, {});
    res.json({
      ...result,
      mode: 'ai',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  } catch (error) {
    console.error('Error in /api/gemini/neuro-categorize:', error);
    res.json({
      brainRegion: 'hippocampus',
      category: 'general',
      summary: (rawContent || rawTitle).slice(0, 110),
      tags: extractKeyTokens(`${rawTitle} ${rawContent}`).slice(0, 3),
      suggestedCodeSnippet: '',
      mode: 'offline-fallback',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  }
});

geminiRouter.post('/api/gemini/auto-link', async (req, res) => {
  const { newNode, existingNodes } = req.body || {};
  if (!newNode || !existingNodes || !Array.isArray(existingNodes)) {
    res.status(400).json({ error: 'newNode and existingNodes array are required' });
    return;
  }

  if (existingNodes.length === 0) {
    res.json({ suggestions: [], mode: 'ai' });
    return;
  }

  const quotaCheck = consumeQuota(req);
  if (!quotaCheck.allowed || !process.env.GEMINI_API_KEY) {
    res.json({
      suggestions: buildOfflineAutoLinks(newNode, existingNodes),
      mode: 'offline-fallback',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
    return;
  }

  try {
    const ai = getGeminiClient();
    const existingSummary = existingNodes
      .slice(0, 30)
      .map(
        (n: Record<string, unknown>) =>
          `- ID: "${n.id}", Title: "${n.title}", Cue: "${n.summary}", Tags: [${
            Array.isArray(n.tags) ? n.tags.join(', ') : ''
          }]`
      )
      .join('\n');

    const prompt = `Connect a new learning cue to related existing cues.
New Cue Title: "${String(newNode.title || '').slice(0, 200)}"
New Cue Hook: "${String(newNode.summary || '').slice(0, 500)}"
Details: "${String(newNode.content || '').slice(0, 1000)}"

Existing Cues:
${existingSummary}

Return 1 to 3 helpful connections with plain-English 2-4 word labels (e.g., "Builds on", "Same pattern", "Helps prevent").`;

    const response = await withAiTimeout(
      ai.models.generateContent({
        model: SERVER_CONFIG.aiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    targetNodeId: { type: Type.STRING },
                    relationship: { type: Type.STRING },
                    strength: { type: Type.NUMBER },
                    label: { type: Type.STRING }
                  },
                  required: ['targetNodeId', 'relationship', 'strength', 'label']
                }
              }
            },
            required: ['suggestions']
          }
        }
      })
    );

    const result = safeParseJson<{ suggestions?: unknown[] }>(response.text, { suggestions: [] });
    res.json({
      ...result,
      mode: 'ai',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  } catch (error) {
    console.error('Error in /api/gemini/auto-link:', error);
    res.json({
      suggestions: buildOfflineAutoLinks(newNode, existingNodes),
      mode: 'offline-fallback',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  }
});

async function handleConceptCheck(req: import('express').Request, res: import('express').Response) {
  const { conceptTitle, userExplanation, canonicalDetails, cueSummary } = req.body || {};
  if (
    !userExplanation ||
    !conceptTitle ||
    typeof userExplanation !== 'string' ||
    typeof conceptTitle !== 'string'
  ) {
    res.status(400).json({ error: 'conceptTitle and userExplanation are required' });
    return;
  }

  const trimmed = userExplanation.trim().slice(0, 4000);
  const safeTitle = conceptTitle.slice(0, 200);
  const safeSummary = typeof cueSummary === 'string' ? cueSummary.slice(0, 600) : '';
  const safeDetails = typeof canonicalDetails === 'string' ? canonicalDetails.slice(0, 4000) : '';

  const words = trimmed.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z0-9]/g, '').length >= 2);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  if (words.length < 10 || uniqueWords.size < 6) {
    res.status(400).json({
      error:
        'Please write at least 10 meaningful words explaining how or why this idea works before checking.'
    });
    return;
  }

  const quotaCheck = consumeQuota(req);
  if (!quotaCheck.allowed) {
    res.json({
      ...evaluateConceptOffline(
        safeTitle,
        safeDetails,
        safeSummary,
        trimmed,
        `Daily AI demo limit (${quotaCheck.status.limit}/day) reached—using smart offline check until reset.`
      ),
      quota: { remaining: 0, limit: quotaCheck.status.limit, resetAt: quotaCheck.status.resetAt }
    });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.json({
      ...evaluateConceptOffline(
        safeTitle,
        safeDetails,
        safeSummary,
        trimmed,
        'AI key is not configured on this server—using smart offline check.'
      ),
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
    return;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are a friendly study coach grading a learner's recall of "${safeTitle}".
CRITICAL GRADING RULE:
Grade based on MEANING and CORE IDEA—NOT word-for-word textbook phrasing.
If the user uses completely different everyday words, analogies, or casual language that capture the true meaning, give them high credit!

Reference Hook: "${safeSummary}"
Reference Details: "${safeDetails}"
User's Explanation: "${trimmed}"

Return JSON:
1. score: integer 1-100 reflecting conceptual understanding (not exact wording).
2. understood: boolean (true if they grasped the main idea, i.e. score >= 65).
3. praise: 1 encouraging sentence noting what idea they nailed in their own words.
4. missingAspects: 1 short sentence pointing out any missing nuance or misconception (or "Nothing major missed!" if solid).
5. simplifiedMetaphor: a crisp everyday analogy to lock the idea in memory.`;

    const response = await withAiTimeout(
      ai.models.generateContent({
        model: SERVER_CONFIG.aiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              understood: { type: Type.BOOLEAN },
              praise: { type: Type.STRING },
              missingAspects: { type: Type.STRING },
              simplifiedMetaphor: { type: Type.STRING }
            },
            required: ['score', 'understood', 'praise', 'missingAspects', 'simplifiedMetaphor']
          }
        }
      })
    );

    const result = safeParseJson<Record<string, unknown>>(response.text, {});
    res.json({
      ...result,
      mode: 'ai',
      quota: {
        remaining: quotaCheck.status.remaining,
        limit: quotaCheck.status.limit,
        resetAt: quotaCheck.status.resetAt
      }
    });
  } catch (error) {
    console.error('Error in concept check:', error);
    res.json({
      ...evaluateConceptOffline(
        safeTitle,
        safeDetails,
        safeSummary,
        trimmed,
        'AI service was temporarily busy—using smart offline check instead.'
      ),
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  }
}

geminiRouter.post('/api/gemini/concept-check', handleConceptCheck);
geminiRouter.post('/api/gemini/feynman-eval', handleConceptCheck);

geminiRouter.post('/api/gemini/scenario-challenge', async (req, res) => {
  const { conceptTitle, cueSummary, canonicalDetails, subject } = req.body || {};
  if (!conceptTitle || typeof conceptTitle !== 'string') {
    res.status(400).json({ error: 'conceptTitle is required' });
    return;
  }

  const safeTitle = conceptTitle.slice(0, 200);
  const safeSummary = typeof cueSummary === 'string' ? cueSummary.slice(0, 600) : '';
  const safeDetails = typeof canonicalDetails === 'string' ? canonicalDetails.slice(0, 4000) : '';
  const safeSubject = typeof subject === 'string' ? subject.slice(0, 80) : 'General';

  const quotaCheck = consumeQuota(req);
  if (!quotaCheck.allowed || !process.env.GEMINI_API_KEY) {
    res.json({
      ...buildOfflineScenario(safeTitle, safeSummary, safeDetails),
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
    return;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Create a short, practical 2-sentence real-world scenario quiz to test applied recall of "${safeTitle}" (Subject: ${safeSubject}).
Core Cue: "${safeSummary}"
Extra Details: "${safeDetails}"

Return JSON with:
- scenarioPrompt: 2 short sentences describing a realistic situation a learner or practitioner actually faces.
- question: 1 crisp question asking what to do or expect next.
- options: array of exactly 3 plausible short choices (only 1 truly right, avoid absurd jokes).
- correctIndex: integer 0, 1, or 2 indicating the right option.
- explanation: 1 encouraging sentence explaining WHY that option works.`;

    const response = await withAiTimeout(
      ai.models.generateContent({
        model: SERVER_CONFIG.aiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenarioPrompt: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ['scenarioPrompt', 'question', 'options', 'correctIndex', 'explanation']
          }
        }
      })
    );

    const result = safeParseJson<{
      scenarioPrompt?: string;
      question?: string;
      options?: string[];
      correctIndex?: number;
      explanation?: string;
    }>(response.text, {});
    const safeOptions =
      Array.isArray(result.options) && result.options.length >= 3
        ? result.options.slice(0, 3)
        : buildOfflineScenario(safeTitle, safeSummary, safeDetails).options;
    const safeIdx =
      typeof result.correctIndex === 'number' && result.correctIndex >= 0 && result.correctIndex < 3
        ? result.correctIndex
        : 0;

    res.json({
      scenarioPrompt: result.scenarioPrompt,
      question: result.question,
      options: safeOptions,
      correctIndex: safeIdx,
      explanation: result.explanation,
      mode: 'ai',
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  } catch (error) {
    console.error('Scenario generation error:', error);
    res.json({
      ...buildOfflineScenario(safeTitle, safeSummary, safeDetails),
      quota: { remaining: quotaCheck.status.remaining, limit: quotaCheck.status.limit }
    });
  }
});
