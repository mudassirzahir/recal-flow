const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'as',
  'by',
  'from',
  'into',
  'like',
  'just',
  'so',
  'than',
  'then',
  'when',
  'where',
  'how',
  'what',
  'why',
  'you',
  'your',
  'we',
  'they',
  'them',
  'can',
  'will',
  'would',
  'about',
  'only',
  'all',
  'not',
  'no',
  'more',
  'most',
  'very',
  'also',
  'before',
  'after',
  'instead'
]);

export function extractKeyTokens(text: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    )
  );
}

export function evaluateConceptOffline(
  conceptTitle: string,
  canonicalDetails: string,
  cueSummary: string,
  userExplanation: string,
  quotaNotice: string
) {
  const referenceTokens = extractKeyTokens(`${conceptTitle} ${cueSummary} ${canonicalDetails}`);
  const userTokens = extractKeyTokens(userExplanation);

  const matched: string[] = [];
  const missed: string[] = [];

  for (const ref of referenceTokens) {
    const stem = ref.slice(0, Math.max(4, ref.length - 2));
    const found = userTokens.some(
      (ut) => ut === ref || ut.startsWith(stem) || ref.startsWith(ut.slice(0, 4))
    );
    if (found) matched.push(ref);
    else missed.push(ref);
  }

  const coverage = referenceTokens.length > 0 ? matched.length / referenceTokens.length : 0.5;
  const wordCount = userExplanation.trim().split(/\s+/).length;
  const effortBonus = Math.min(20, Math.round(wordCount * 1.1));
  const rawScore = Math.min(94, Math.max(28, Math.round(coverage * 75 + effortBonus)));

  return {
    score: rawScore,
    understood: rawScore >= 60,
    praise:
      matched.length > 0
        ? `Good job explaining in your own words—you touched on core ideas around ${matched.slice(0, 3).join(', ')}.`
        : 'Nice effort putting the concept into everyday language.',
    missingAspects:
      missed.length > 0
        ? `Consider also mentioning how it connects to: ${missed.slice(0, 4).join(', ')}.`
        : 'Your explanation covers the core idea clearly.',
    simplifiedMetaphor:
      cueSummary ||
      `Think of ${conceptTitle} as a shortcut cue for its main cause-and-effect loop.`,
    mode: 'offline-fallback',
    quotaNotice
  };
}

export function buildOfflineScenario(
  conceptTitle: string,
  cueSummary: string,
  canonicalDetails: string
) {
  return {
    scenarioPrompt: `Imagine you run into a real situation where "${conceptTitle}" decides whether things go smoothly or break down.`,
    question: `Which decision best applies the core rule of ${conceptTitle}?`,
    options: [
      cueSummary || `Apply the core principle of ${conceptTitle} right at the bottleneck.`,
      'Skip testing or verification and repeat the same input blindly without timing.',
      'Rely on surface-level naming alone rather than checking the underlying cause.'
    ],
    correctIndex: 0,
    explanation:
      canonicalDetails ||
      cueSummary ||
      `Recognizing when "${conceptTitle}" applies prevents silent failure and transfers knowledge into action.`,
    mode: 'offline-fallback'
  };
}

export function buildOfflineAutoLinks(
  newNode: { id?: unknown; title?: unknown; summary?: unknown; tags?: unknown },
  existingNodes: Record<string, unknown>[]
) {
  const newTokens = new Set(
    extractKeyTokens(
      `${newNode.title || ''} ${newNode.summary || ''} ${Array.isArray(newNode.tags) ? newNode.tags.join(' ') : ''}`
    )
  );
  const scored = existingNodes
    .filter((n) => !newNode.id || n.id !== newNode.id)
    .map((n) => {
      const tags = Array.isArray(n.tags) ? n.tags.join(' ') : '';
      const t = extractKeyTokens(`${n.title || ''} ${n.summary || ''} ${tags}`);
      const overlap = t.filter((w) => newTokens.has(w)).length;
      return { node: n, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2);

  return scored.map((s) => ({
    targetNodeId: s.node.id,
    relationship: 'associated_with',
    strength: 0.72,
    label: 'Shared topic'
  }));
}
