import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ConceptNode, QuotaStatus } from '../types';
import { BRAIN_REGIONS } from '../data/initialData';
import { CueIcon } from '../utils/cueIcons';
import { isCueDue, getCueSubject, matchesDateFilter } from '../utils/dateFilters';
import { ambientSynth } from '../utils/audioSynth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Zap,
  Sparkles,
  CheckCircle2,
  RotateCw,
  HelpCircle,
  Award,
  ArrowRight,
  Info,
  WifiOff,
  Pencil,
  BookOpen,
  PenLine,
  Compass,
  Flame,
  Gamepad2,
  Trophy,
  Timer,
  Volume2,
  VolumeX,
  ExternalLink,
  Copy,
  Check,
  Quote,
  AlertCircle,
  Shuffle,
  Mic,
  MicOff,
  Square,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';

type PracticeMethod = 'flashcard' | 'cloze' | 'blitz' | 'scenario' | 'teach-back' | 'ai-coach';
type QueueScope = 'due' | 'all';
type BlitzPhase = 'menu' | 'playing' | 'summary';
type CoachMode = 'quiz' | 'teach';
type CoachScope = 'due' | 'today' | 'all';
type ConfidenceLevel = 'guessing' | 'unsure' | 'confident';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

interface SpacedRepetitionDeckProps {
  nodes: ConceptNode[];
  subjects: string[];
  initialSubjectFilter?: string;
  onClearSubjectFilter?: () => void;
  initialMethod?: PracticeMethod;
  onClearInitialMethod?: () => void;
  onReviewNode: (nodeId: string, rating: 1 | 2 | 3 | 4) => void;
  onBlitzComplete: (score: number, xpEarned: number, matchedNodeIds: string[]) => void;
  onEditNode?: (node: ConceptNode) => void;
  onGoToNotes?: () => void;
  onShowToast?: (msg: string) => void;
  focusNodeId?: string | null;
  onClearFocusNode?: () => void;
  userId?: string | null;
}

const CLOZE_STOP = new Set([
  'about',
  'above',
  'after',
  'again',
  'always',
  'because',
  'before',
  'being',
  'between',
  'could',
  'every',
  'first',
  'instead',
  'other',
  'should',
  'since',
  'their',
  'there',
  'these',
  'thing',
  'those',
  'through',
  'under',
  'until',
  'using',
  'where',
  'which',
  'while',
  'without',
  'would',
  'unless'
]);

function buildClozePrompt(
  summary: string,
  content?: string
): { masked: string; answer: string; hints: string[]; isCustom: boolean } {
  const combinedSource = summary.includes('{{')
    ? summary
    : content && content.includes('{{')
      ? content
      : summary;

  const customMatches = Array.from(combinedSource.matchAll(/\{\{([^{}]{1,60})\}\}/g));
  const distractorPool = ['timing', 'memory', 'focus', 'clarity', 'pattern', 'habit', 'effect'];

  if (customMatches.length > 0) {
    const primaryAnswer = customMatches[0][1].trim();
    const masked = combinedSource.replace(/\{\{([^{}]{1,60})\}\}/g, '________');
    const customAnswers = customMatches.map((m) => m[1].trim()).filter(Boolean);
    const hints = Array.from(new Set([...customAnswers, ...distractorPool]))
      .slice(0, 4)
      .sort((a, b) => a.localeCompare(b));
    return {
      masked,
      answer: primaryAnswer,
      hints,
      isCustom: true
    };
  }

  const words = summary.trim().split(/\s+/);
  const candidates = words
    .map((raw, idx) => ({ raw, clean: raw.replace(/[^a-zA-Z0-9-]/g, ''), idx }))
    .filter((w) => w.clean.length >= 5 && !CLOZE_STOP.has(w.clean.toLowerCase()));

  if (candidates.length === 0) {
    return { masked: summary, answer: '', hints: [], isCustom: false };
  }

  const picked = [...candidates].sort((a, b) => b.clean.length - a.clean.length)[0];
  const maskedWords = words.map((w, i) => (i === picked.idx ? '________' : w));

  const hints = Array.from(
    new Set([picked.clean, ...candidates.slice(1, 3).map((c) => c.clean), ...distractorPool])
  )
    .slice(0, 4)
    .sort((a, b) => a.localeCompare(b));

  return {
    masked: maskedWords.join(' '),
    answer: picked.clean,
    hints,
    isCustom: false
  };
}

function interleaveBySubject(sortedNodes: ConceptNode[]): ConceptNode[] {
  const buckets = new Map<string, ConceptNode[]>();
  sortedNodes.forEach((n) => {
    const sub = getCueSubject(n);
    const arr = buckets.get(sub) || [];
    arr.push(n);
    buckets.set(sub, arr);
  });

  const queues = Array.from(buckets.values());
  const result: ConceptNode[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        result.push(next);
        added = true;
      }
    }
  }
  return result;
}

function getWordStats(text: string): { meaningfulCount: number; uniqueCount: number } {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9'-]/g, ''))
    .filter((w) => w.length >= 2);
  const unique = new Set(tokens.map((w) => w.toLowerCase()));
  return { meaningfulCount: tokens.length, uniqueCount: unique.size };
}

function shuffleList<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const SpacedRepetitionDeck: React.FC<SpacedRepetitionDeckProps> = ({
  nodes,
  subjects,
  initialSubjectFilter,
  onClearSubjectFilter,
  initialMethod,
  onClearInitialMethod,
  onReviewNode,
  onBlitzComplete,
  onEditNode,
  onGoToNotes,
  onShowToast,
  focusNodeId,
  onClearFocusNode,
  userId
}) => {
  const [queueScope, setQueueScope] = useState<QueueScope>('due');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [isInterleaved, setIsInterleaved] = useState(true);
  const [method, setMethod] = useState<PracticeMethod>('flashcard');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  // Web Speech API (TTS + STT)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);

  const supportsSpeechSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const SpeechRecConstructor: SpeechRecognitionConstructor | null =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .webkitSpeechRecognition ||
        null
      : null;

  // Cloze state
  const [clozeInput, setClozeInput] = useState('');
  const [clozeChecked, setClozeChecked] = useState<'correct' | 'wrong' | null>(null);

  // Scenario Quiz state
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioData, setScenarioData] = useState<{
    scenarioPrompt: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    mode?: string;
  } | null>(null);
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number | null>(null);

  // Teach-Back (Feynman AI) state
  const [userExplanation, setUserExplanation] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [evalResult, setEvalResult] = useState<{
    score: number;
    understood?: boolean;
    praise: string;
    missingAspects: string;
    simplifiedMetaphor: string;
    mode?: string;
    quotaNotice?: string;
  } | null>(null);

  // Quick Match / Blitz Mini-Game state
  const [blitzPhase, setBlitzPhase] = useState<BlitzPhase>('menu');
  const [blitzPairs, setBlitzPairs] = useState<ConceptNode[]>([]);
  const [blitzRightOrder, setBlitzRightOrder] = useState<ConceptNode[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [mismatchPair, setMismatchPair] = useState<{ left: string; right: string } | null>(null);
  const [blitzScore, setBlitzScore] = useState(0);
  const [blitzStreak, setBlitzStreak] = useState(0);
  const [blitzAttempts, setBlitzAttempts] = useState(0);
  const [blitzElapsedSec, setBlitzElapsedSec] = useState(0);
  const [blitzLastXp, setBlitzLastXp] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const blitzLockRef = useRef(false);

  // External AI Coach Prompt Builder state
  const [coachMode, setCoachMode] = useState<CoachMode>('quiz');
  const [coachScope, setCoachScope] = useState<CoachScope>('due');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const allSubjects = useMemo(() => {
    const set = new Set<string>(subjects);
    nodes.forEach((n) => set.add(getCueSubject(n)));
    return Array.from(set);
  }, [subjects, nodes]);

  useEffect(() => {
    if (initialSubjectFilter) {
      setSubjectFilter(initialSubjectFilter);
      setCurrentIndex(0);
      setIsFlipped(false);
      onClearSubjectFilter?.();
    }
  }, [initialSubjectFilter, onClearSubjectFilter]);

  useEffect(() => {
    if (initialMethod) {
      setMethod(initialMethod);
      if (initialMethod === 'blitz') {
        setBlitzPhase('menu');
      }
      onClearInitialMethod?.();
    }
  }, [initialMethod, onClearInitialMethod]);

  const dueCount = useMemo(() => nodes.filter((n) => isCueDue(n)).length, [nodes]);

  const activeQueue = useMemo(() => {
    const filtered = nodes.filter((n) => {
      if (subjectFilter !== 'all' && getCueSubject(n) !== subjectFilter) return false;
      if (queueScope === 'due') return isCueDue(n);
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const scoreDiff = (a.srsData?.retentionScore || 0) - (b.srsData?.retentionScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.srsData?.reps || 0) - (b.srsData?.reps || 0);
    });

    if (isInterleaved && subjectFilter === 'all' && sorted.length > 2) {
      return interleaveBySubject(sorted);
    }

    return sorted;
  }, [nodes, queueScope, subjectFilter, isInterleaved]);

  const resetCardInteractionState = useCallback(() => {
    setIsFlipped(false);
    setConfidenceLevel(null);
    setClozeInput('');
    setClozeChecked(null);
    setScenarioData(null);
    setScenarioError(null);
    setSelectedScenarioIdx(null);
    setUserExplanation('');
    setEvalResult(null);
    setEvalError(null);
    if (supportsSpeechSynth) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    recognitionRef.current?.stop();
    setIsDictating(false);
  }, [supportsSpeechSynth]);

  useEffect(() => {
    if (!focusNodeId) return;
    const targetNode = nodes.find((n) => n.id === focusNodeId);
    if (!targetNode) return;

    const targetIsDue = isCueDue(targetNode);
    const nextScope: QueueScope = targetIsDue ? 'due' : 'all';
    setQueueScope(nextScope);
    setSubjectFilter('all');

    const pool = nodes
      .filter((n) => (nextScope === 'due' ? isCueDue(n) : true))
      .sort((a, b) => (a.srsData?.retentionScore || 0) - (b.srsData?.retentionScore || 0));

    const idx = pool.findIndex((n) => n.id === focusNodeId);
    setCurrentIndex(idx >= 0 ? idx : 0);
    resetCardInteractionState();
    onClearFocusNode?.();
  }, [focusNodeId, nodes, onClearFocusNode, resetCardInteractionState]);

  useEffect(() => {
    if (activeQueue.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= activeQueue.length) {
      setCurrentIndex(0);
    }
  }, [activeQueue.length, currentIndex]);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const headers: Record<string, string> = {};
        if (userId) headers['x-user-id'] = userId;
        const res = await fetch('/api/gemini/quota', { headers });
        if (res.ok) {
          const data = await res.json();
          setQuota(data);
        }
      } catch {
        // Ignore network errors
      }
    };
    fetchQuota();
  }, [userId]);

  // Quick Match Blitz elapsed clock — automatically pauses when tab is hidden via Page Visibility API
  useEffect(() => {
    if (method !== 'blitz' || blitzPhase !== 'playing') return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setBlitzElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [method, blitzPhase]);

  useEffect(() => {
    return () => {
      if (supportsSpeechSynth) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current?.stop();
    };
  }, [supportsSpeechSynth]);

  const currentNode = activeQueue[currentIndex % Math.max(1, activeQueue.length)];
  const clozeChallenge = useMemo(
    () =>
      currentNode
        ? buildClozePrompt(currentNode.summary, currentNode.content)
        : { masked: '', answer: '', hints: [], isCustom: false },
    [currentNode]
  );

  const explanationStats = useMemo(() => getWordStats(userExplanation), [userExplanation]);
  const meetsWordRequirement =
    explanationStats.meaningfulCount >= 10 && explanationStats.uniqueCount >= 6;

  const handleToggleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supportsSpeechSynth || !currentNode) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const spokenText = isFlipped
      ? `${currentNode.title}. ${currentNode.summary}`
      : currentNode.title;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleDictation = () => {
    if (!SpeechRecConstructor) return;

    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    try {
      const rec = new SpeechRecConstructor();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (event) => {
        const transcriptParts: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal && item[0]?.transcript) {
            transcriptParts.push(item[0].transcript.trim());
          }
        }
        if (transcriptParts.length > 0) {
          const addition = transcriptParts.join(' ');
          setUserExplanation((prev) => (prev.trim() ? `${prev.trim()} ${addition}` : addition));
          setEvalError(null);
        }
      };
      rec.onerror = () => {
        setIsDictating(false);
        onShowToast?.('Voice input unavailable right now');
      };
      rec.onend = () => setIsDictating(false);

      recognitionRef.current = rec;
      rec.start();
      setIsDictating(true);
    } catch {
      setIsDictating(false);
      onShowToast?.('Could not start microphone dictation');
    }
  };

  const handleRate = (rating: 1 | 2 | 3 | 4) => {
    if (!currentNode) return;

    if (confidenceLevel === 'confident' && rating <= 2) {
      onShowToast?.('Overconfidence caught — marking this note sooner builds real calibration!');
    }

    if (rating >= 3) {
      confetti({
        particleCount: 32,
        spread: 55,
        origin: { y: 0.7 }
      });
    }

    setSessionCount((c) => c + 1);
    onReviewNode(currentNode.id, rating);
    resetCardInteractionState();

    if (currentIndex < activeQueue.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (activeQueue.length === 0 || method === 'blitz' || method === 'ai-coach') return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        resetCardInteractionState();
        setCurrentIndex((prev) => (prev + 1) % activeQueue.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        resetCardInteractionState();
        setCurrentIndex((prev) => (prev - 1 + activeQueue.length) % activeQueue.length);
      } else if ((e.key === ' ' || e.key === 'Enter') && method === 'flashcard') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (method === 'flashcard' && isFlipped) {
        if (e.key === '1') {
          e.preventDefault();
          handleRate(1);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate(2);
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate(3);
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate(4);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleCheckCloze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clozeInput.trim()) return;
    const isMatch = clozeInput.trim().toLowerCase() === clozeChallenge.answer.toLowerCase();
    setClozeChecked(isMatch ? 'correct' : 'wrong');
  };

  const handleLoadScenario = async () => {
    if (!currentNode) return;
    setScenarioLoading(true);
    setScenarioError(null);
    setSelectedScenarioIdx(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;
      const res = await fetch('/api/gemini/scenario-challenge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conceptTitle: currentNode.title,
          cueSummary: currentNode.summary,
          canonicalDetails: currentNode.content,
          subject: getCueSubject(currentNode)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setScenarioError(data?.error || 'Could not generate a scenario right now. Try again.');
        return;
      }
      setScenarioData(data);
      if (data.quota) {
        setQuota((prev) => ({
          remaining: data.quota.remaining,
          limit: data.quota.limit,
          resetAt: prev?.resetAt || '',
          isConfigured: prev?.isConfigured ?? true
        }));
      }
    } catch (err) {
      console.error('Scenario quiz error:', err);
      setScenarioError('Network error — please try again.');
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleEvaluateConcept = async () => {
    if (!currentNode || !meetsWordRequirement) return;

    setIsEvaluating(true);
    setEvalError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;

      const response = await fetch('/api/gemini/concept-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conceptTitle: currentNode.title,
          cueSummary: currentNode.summary,
          canonicalDetails: currentNode.content,
          userExplanation
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setEvalError(data.error || 'Could not evaluate right now. Please try again.');
        return;
      }

      setEvalResult(data);
      if (data.quota) {
        setQuota((prev) => ({
          remaining: data.quota.remaining,
          limit: data.quota.limit,
          resetAt: data.quota.resetAt || prev?.resetAt || '',
          isConfigured: prev?.isConfigured ?? true
        }));
      }
    } catch (err) {
      console.error('Concept check error:', err);
      setEvalError('Network error — please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // --- Quick Match / Blitz Engine ---
  const blitzPool = useMemo(
    () => (activeQueue.length >= 3 ? activeQueue : nodes),
    [activeQueue, nodes]
  );

  const startBlitzRound = (useAllNotesFallback = false) => {
    const sourcePool = useAllNotesFallback ? nodes : blitzPool;
    if (sourcePool.length < 3) return;
    const picked = shuffleList(sourcePool).slice(0, Math.min(5, sourcePool.length));
    setBlitzPairs(picked);
    setBlitzRightOrder(shuffleList(picked));
    setSelectedLeftId(null);
    setSelectedRightId(null);
    setMatchedIds([]);
    setMismatchPair(null);
    setBlitzScore(0);
    setBlitzStreak(0);
    setBlitzAttempts(0);
    setBlitzElapsedSec(0);
    setBlitzLastXp(0);
    blitzLockRef.current = false;
    setBlitzPhase('playing');
  };

  const handleBlitzPick = (side: 'left' | 'right', id: string) => {
    if (blitzPhase !== 'playing' || blitzLockRef.current || matchedIds.includes(id)) return;

    const nextLeft = side === 'left' ? (selectedLeftId === id ? null : id) : selectedLeftId;
    const nextRight = side === 'right' ? (selectedRightId === id ? null : id) : selectedRightId;

    setSelectedLeftId(nextLeft);
    setSelectedRightId(nextRight);

    if (nextLeft && nextRight) {
      blitzLockRef.current = true;
      setBlitzAttempts((a) => a + 1);

      if (nextLeft === nextRight) {
        const nextStreak = blitzStreak + 1;
        const multiplier = nextStreak >= 4 ? 3 : nextStreak >= 2 ? 2 : 1;
        const pointsEarned = 100 * multiplier;
        const nextScore = blitzScore + pointsEarned;
        const nextMatched = [...matchedIds, nextLeft];

        setBlitzStreak(nextStreak);
        setBlitzScore(nextScore);
        setMatchedIds(nextMatched);
        setSelectedLeftId(null);
        setSelectedRightId(null);
        if (soundEnabled) ambientSynth.playChime('match');

        if (nextMatched.length >= blitzPairs.length) {
          const speedBonus = Math.max(0, 60 - blitzElapsedSec) * 3;
          const totalScore = nextScore + speedBonus;
          const xpEarned = Math.min(80, Math.max(25, Math.round(totalScore / 20)));
          setBlitzScore(totalScore);
          setBlitzLastXp(xpEarned);
          setSessionCount((c) => c + nextMatched.length);
          if (soundEnabled) ambientSynth.playChime('victory');
          confetti({ particleCount: 55, spread: 70, origin: { y: 0.65 } });
          onBlitzComplete(totalScore, xpEarned, nextMatched);
          setTimeout(() => {
            blitzLockRef.current = false;
            setBlitzPhase('summary');
          }, 320);
        } else {
          blitzLockRef.current = false;
        }
      } else {
        setBlitzStreak(0);
        setMismatchPair({ left: nextLeft, right: nextRight });
        if (soundEnabled) ambientSynth.playChime('miss');
        setTimeout(() => {
          setMismatchPair(null);
          setSelectedLeftId(null);
          setSelectedRightId(null);
          blitzLockRef.current = false;
        }, 420);
      }
    }
  };

  // --- External AI Coach Prompt Builder ---
  const coachNodes = useMemo(() => {
    const base =
      coachScope === 'due'
        ? nodes.filter((n) => isCueDue(n))
        : coachScope === 'today'
          ? nodes.filter((n) => matchesDateFilter(n, 'today'))
          : nodes;
    const subjectFiltered =
      subjectFilter === 'all' ? base : base.filter((n) => getCueSubject(n) === subjectFilter);
    return (subjectFiltered.length > 0 ? subjectFiltered : nodes).slice(0, 10);
  }, [nodes, coachScope, subjectFilter]);

  const coachPromptText = useMemo(() => {
    if (coachNodes.length === 0) return '';
    const listText = coachNodes
      .map(
        (n, idx) => `${idx + 1}. "${n.title}" [@${getCueSubject(n)}]: ${n.summary.slice(0, 110)}`
      )
      .join('\n');

    if (coachMode === 'quiz') {
      return `Act as a supportive active-recall study coach. Test me one question at a time on these ${coachNodes.length} notes I saved:\n\n${listText}\n\nAsk 1 short application question for note #1 first, wait for my reply, then grade me before moving to the next one.`;
    }
    return `Act as a friendly tutor. Help me connect and deepen these ${coachNodes.length} notes I learned:\n\n${listText}\n\nFirst explain any shared patterns between them with simple everyday analogies, then ask me to teach one back in my own words.`;
  }, [coachNodes, coachMode]);

  const encodedPrompt = useMemo(() => {
    // Keep URL payload compact (< 1100 raw chars -> safely under ~1800 encoded chars)
    // so external apps do not truncate or drop query strings across redirects.
    const trimmed = coachPromptText.slice(0, 1050);
    return encodeURIComponent(trimmed);
  }, [coachPromptText]);

  const copyPromptToClipboard = async (text: string): Promise<boolean> => {
    // Synchronous fallback ensures clipboard succeeds even inside restricted iframes or tab switches
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const copiedSync = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copiedSync) return true;
    } catch {
      // Fall through to async Clipboard API
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Clipboard blocked
    }
    return false;
  };

  const handleCopyCoachPrompt = async (noticeLabel?: string) => {
    if (!coachPromptText) return;
    const ok = await copyPromptToClipboard(coachPromptText);
    if (ok) {
      setCopiedPrompt(true);
      onShowToast?.(noticeLabel || 'Study prompt copied to clipboard');
      setTimeout(() => setCopiedPrompt(false), 2200);
    } else {
      onShowToast?.('Prompt ready — expand preview below to copy manually');
    }
  };

  const stageMeta = currentNode ? BRAIN_REGIONS[currentNode.brainRegion] : null;
  const cardAccent = currentNode
    ? currentNode.cueColor || stageMeta?.color || '#3B82F6'
    : '#3B82F6';

  const soloTabs: { id: PracticeMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'flashcard', label: 'Flashcard', icon: <Zap className="w-3.5 h-3.5 text-amber-500" /> },
    {
      id: 'cloze',
      label: 'Fill Blank',
      icon: <PenLine className="w-3.5 h-3.5 text-emerald-500" />
    },
    { id: 'blitz', label: 'Quick Match', icon: <Gamepad2 className="w-3.5 h-3.5 text-rose-500" /> }
  ];

  const aiTabs: { id: PracticeMethod; label: string; icon: React.ReactNode }[] = [
    {
      id: 'scenario',
      label: 'Scenario',
      icon: <Compass className="w-3.5 h-3.5 text-violet-500" />
    },
    {
      id: 'teach-back',
      label: 'Teach-Back AI',
      icon: <Sparkles className="w-3.5 h-3.5 text-blue-500" />
    },
    {
      id: 'ai-coach',
      label: 'AI Coach',
      icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 text-slate-900 dark:text-slate-100">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 sm:p-5 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Practice Arena
                </h1>
                {sessionCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Flame className="w-3.5 h-3.5" />
                    {sessionCount} completed this session
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solo active-recall drills on the left, AI-assisted coaching &amp; scenarios on the
                right
              </p>
            </div>
          </div>

          <Tabs
            value={method}
            onValueChange={(val) => {
              setMethod(val as PracticeMethod);
              resetCardInteractionState();
              if (val === 'blitz') setBlitzPhase('menu');
            }}
          >
            <TabsList className="h-auto flex-wrap bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl p-1 gap-1">
              {soloTabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.icon}
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
              <span
                className="hidden sm:inline-block w-px h-5 bg-slate-200 dark:bg-[#222634] mx-0.5 self-center"
                aria-hidden="true"
              />
              {aiTabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.icon}
                  <span>{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Queue Scope & @Subject Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#222634]">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {method !== 'ai-coach' && (
              <div className="flex items-center bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222634]">
                <button
                  type="button"
                  onClick={() => {
                    setQueueScope('due');
                    setCurrentIndex(0);
                    resetCardInteractionState();
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    queueScope === 'due'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Due Now ({dueCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQueueScope('all');
                    setCurrentIndex(0);
                    resetCardInteractionState();
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    queueScope === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Free Study All ({nodes.length})
                </button>
              </div>
            )}

            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setCurrentIndex(0);
                resetCardInteractionState();
              }}
              aria-label="Filter practice by subject"
              className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Subjects (@)</option>
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  @{sub}
                </option>
              ))}
            </select>

            {subjectFilter === 'all' && method !== 'blitz' && method !== 'ai-coach' && (
              <button
                type="button"
                onClick={() => {
                  setIsInterleaved((v) => !v);
                  setCurrentIndex(0);
                  resetCardInteractionState();
                }}
                className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isInterleaved
                    ? 'bg-violet-50 dark:bg-violet-950/50 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                    : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-slate-600 dark:text-slate-400'
                }`}
                title="Mix different @Subjects so your brain learns to tell ideas apart"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Interleaved Mix</span>
              </button>
            )}
          </div>

          {method !== 'blitz' && method !== 'ai-coach' && activeQueue.length > 0 && (
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Card {(currentIndex % activeQueue.length) + 1} of {activeQueue.length}
            </span>
          )}
        </div>
      </div>

      {/* MODE 5: QUICK MATCH / BLITZ MINI-GAME */}
      {method === 'blitz' ? (
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-5">
          {nodes.length < 3 ? (
            <div className="py-10 text-center space-y-3 max-w-md mx-auto">
              <Gamepad2 className="w-10 h-10 text-rose-500 mx-auto" />
              <h2 className="font-display text-lg font-bold">
                Need at least 3 notes to play Blitz
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Quick Match pairs your concepts with their takeaways. Add a couple more learning
                notes first, or practice your saved cards with Flashcards.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => setMethod('flashcard')}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Use Flashcards
                </Button>
                {onGoToNotes && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onGoToNotes}
                    className="rounded-xl text-xs cursor-pointer"
                  >
                    Open Notes Vault
                  </Button>
                )}
              </div>
            </div>
          ) : blitzPhase === 'menu' ? (
            <div className="py-6 text-center space-y-5 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center mx-auto">
                <Gamepad2 className="w-6 h-6 text-rose-500" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-bold">Quick Match Blitz</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Match each concept on the left with its key takeaway on the right. Build
                  consecutive hits for <strong>x2 / x3 streak multipliers</strong> and earn bonus
                  XP!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                  <span>Sound {soundEnabled ? 'On' : 'Muted'}</span>
                </button>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5">
                <Button
                  size="lg"
                  onClick={() => startBlitzRound(activeQueue.length < 3)}
                  className="rounded-xl px-6 text-xs font-bold cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    Start Blitz Round (
                    {Math.min(5, activeQueue.length >= 3 ? activeQueue.length : nodes.length)}{' '}
                    Pairs)
                  </span>
                </Button>
              </div>
            </div>
          ) : blitzPhase === 'playing' ? (
            <div className="space-y-4">
              {/* Blitz HUD */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#222634] text-xs">
                <div className="flex items-center gap-4 font-mono tabular-nums">
                  <span className="font-bold text-base text-blue-600 dark:text-blue-400">
                    {blitzScore} pts
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Combo x{blitzStreak >= 4 ? 3 : blitzStreak >= 2 ? 2 : 1}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {matchedIds.length}/{blitzPairs.length} paired
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0B0D12] px-2.5 py-1 rounded-lg">
                    <Timer className="w-3.5 h-3.5 text-rose-500" />
                    {blitzElapsedSec}s
                  </span>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled((s) => !s)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B2030] text-slate-500 cursor-pointer"
                    aria-label="Toggle sound"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2-Column Matching Arena */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    1. Pick a Concept
                  </p>
                  {blitzPairs.map((item) => {
                    const matched = matchedIds.includes(item.id);
                    const selected = selectedLeftId === item.id;
                    const wrong = mismatchPair?.left === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={matched}
                        onClick={() => handleBlitzPick('left', item.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                          matched
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 opacity-60'
                            : wrong
                              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-200'
                              : selected
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 dark:text-white'
                                : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] hover:border-blue-400'
                        }`}
                      >
                        <span className="block truncate">{item.title}</span>
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          @{getCueSubject(item)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    2. Match Its Takeaway
                  </p>
                  {blitzRightOrder.map((item) => {
                    const matched = matchedIds.includes(item.id);
                    const selected = selectedRightId === item.id;
                    const wrong = mismatchPair?.right === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={matched}
                        onClick={() => handleBlitzPick('right', item.id)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs leading-relaxed transition-all cursor-pointer ${
                          matched
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 opacity-60'
                            : wrong
                              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-200'
                              : selected
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 dark:text-white'
                                : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] hover:border-blue-400'
                        }`}
                      >
                        <span className="line-clamp-2">{item.summary}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* SUMMARY PHASE */
            <div className="py-6 text-center space-y-5 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-2xl font-bold">Round Complete!</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  All {blitzPairs.length} concepts matched · Memory &amp; XP updated
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]">
                  <span className="text-[11px] text-slate-500 block">Score</span>
                  <span className="font-mono tabular-nums font-bold text-lg text-blue-600 dark:text-blue-400">
                    {blitzScore}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]">
                  <span className="text-[11px] text-slate-500 block">Accuracy</span>
                  <span className="font-mono tabular-nums font-bold text-lg text-emerald-600 dark:text-emerald-400">
                    {blitzAttempts > 0
                      ? Math.round((blitzPairs.length / blitzAttempts) * 100)
                      : 100}
                    %
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]">
                  <span className="text-[11px] text-slate-500 block">XP Earned</span>
                  <span className="font-mono tabular-nums font-bold text-lg text-amber-600 dark:text-amber-400">
                    +{blitzLastXp}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5">
                <Button
                  onClick={() => startBlitzRound(activeQueue.length < 3)}
                  className="rounded-xl px-5 text-xs font-semibold cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Play Again</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMethod('flashcard')}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Back to Flashcards
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : method === 'ai-coach' ? (
        /* MODE 6: EXTERNAL AI COACH (ChatGPT, Claude, Gemini with editable/copyable prompt) */
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 sm:p-6 space-y-5">
          {nodes.length === 0 ? (
            <div className="py-10 text-center space-y-3 max-w-md mx-auto">
              <MessageSquare className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="font-display text-lg font-bold">No notes to practice yet</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Save a learning note first and AI Coach will package it into a personalized Socratic
                study session for ChatGPT, Claude, or Gemini.
              </p>
              {onGoToNotes && (
                <Button
                  variant="outline"
                  onClick={onGoToNotes}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open Notes Vault</span>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#222634]">
                <div>
                  <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>External AI Coach</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Launch ChatGPT, Claude, or Gemini in a new tab with your selected notes packaged
                    as a {coachMode === 'quiz' ? 'Quiz Me' : 'Teach & Deepen'} prompt.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                  <div className="flex items-center bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222634]">
                    <button
                      type="button"
                      onClick={() => setCoachMode('quiz')}
                      className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                        coachMode === 'quiz'
                          ? 'bg-white dark:bg-[#1B2030] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Quiz &amp; Test Me
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoachMode('teach')}
                      className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                        coachMode === 'teach'
                          ? 'bg-white dark:bg-[#1B2030] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Teach &amp; Deepen
                    </button>
                  </div>

                  <div className="flex items-center bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-lg border border-slate-200 dark:border-[#222634]">
                    {(['due', 'today', 'all'] as CoachScope[]).map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setCoachScope(sc)}
                        className={`px-2.5 py-1 rounded-md font-medium capitalize cursor-pointer transition-colors ${
                          coachScope === sc
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {sc === 'due' ? 'Due' : sc === 'today' ? 'Today' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Ready Prompt Preview ({coachNodes.length} note
                    {coachNodes.length === 1 ? '' : 's'}
                    {subjectFilter !== 'all' ? ` · @${subjectFilter}` : ''})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCoachPrompt('Study prompt copied!')}
                    className="h-7 rounded-lg text-xs cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                  </Button>
                </div>

                <Textarea
                  rows={6}
                  readOnly
                  value={coachPromptText}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs font-mono leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#222634]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ChatGPT and Claude prefill via link. Gemini does not support URL prefill, so
                  clicking Gemini copies your prompt automatically—press{' '}
                  <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] font-mono text-[10px]">
                    Ctrl/⌘+V
                  </kbd>{' '}
                  in the chat box.
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold shrink-0">
                  <a
                    href={`https://chatgpt.com/?q=${encodedPrompt}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleCopyCoachPrompt('Prompt copied & opening ChatGPT')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Open ChatGPT</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={`https://claude.ai/new?q=${encodedPrompt}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleCopyCoachPrompt('Prompt copied & opening Claude')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Open Claude</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href="https://gemini.google.com/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleCopyCoachPrompt(
                        'Prompt copied — press Ctrl+V / ⌘V inside Gemini to start!'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Copy &amp; Open Gemini</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      ) : !currentNode ? (
        /* Caught Up Empty State */
        <div className="w-full min-h-[340px] bg-white dark:bg-[#13161F] rounded-2xl border border-slate-200 dark:border-[#222634] p-8 flex flex-col items-center justify-center text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div className="space-y-1.5 max-w-md">
            <h2 className="font-display text-xl font-bold">
              {nodes.length === 0
                ? 'No notes saved yet'
                : subjectFilter !== 'all'
                  ? `You are caught up in @${subjectFilter}`
                  : 'You are all caught up on due practice'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {nodes.length === 0
                ? 'Capture a quick learning note first and it will appear in your spaced queue right away.'
                : 'Every scheduled note in this filter is fresh. Run Free Study, play Quick Match Blitz, or switch to the AI Coach tab.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {nodes.length > 0 && (
              <>
                <Button
                  onClick={() => {
                    setQueueScope('all');
                    setCurrentIndex(0);
                    resetCardInteractionState();
                  }}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Free Study Matching Notes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMethod('ai-coach')}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Open AI Coach</span>
                </Button>
              </>
            )}
            {onGoToNotes && (
              <Button
                variant="outline"
                onClick={onGoToNotes}
                className="rounded-xl text-xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Browse Notes Vault</span>
              </Button>
            )}
          </div>
        </div>
      ) : method === 'flashcard' ? (
        /* MODE 1: Flashcard Active Recall */
        <div className="space-y-4">
          <div
            onClick={() => setIsFlipped((f) => !f)}
            className="w-full min-h-[320px] bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] hover:border-slate-300 dark:hover:border-slate-700 p-7 rounded-2xl cursor-pointer transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-2 font-medium">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: `${cardAccent}20` }}
                >
                  <CueIcon icon={currentNode.cueIcon} className="w-3.5 h-3.5" color={cardAccent} />
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  @{getCueSubject(currentNode)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{stageMeta?.name || 'Fresh Notes'}</span>
              </span>

              <div className="flex items-center gap-3">
                {supportsSpeechSynth && (
                  <button
                    type="button"
                    onClick={handleToggleSpeak}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isSpeaking
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                    title={isSpeaking ? 'Stop reading aloud' : 'Read card aloud'}
                  >
                    {isSpeaking ? (
                      <Square className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                  </button>
                )}
                {onEditNode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditNode(currentNode);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B2030] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    title="Edit note"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300" />
                  <span>{isFlipped ? 'Hide answer' : 'Click or Space to flip'}</span>
                </span>
              </div>
            </div>

            <div className="my-6">
              {!isFlipped ? (
                <div className="text-center space-y-4">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Retrieve from memory before flipping
                  </p>
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white max-w-xl mx-auto leading-snug text-balance">
                    {currentNode.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Explain the main takeaway in your own words first.
                  </p>

                  {/* Pre-Reveal Confidence Calibration */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs"
                  >
                    <span className="text-[11px] text-slate-400 mr-1">Confidence check:</span>
                    {(
                      [
                        { id: 'guessing', label: 'Guessing' },
                        { id: 'unsure', label: 'Unsure' },
                        { id: 'confident', label: 'Confident' }
                      ] as { id: ConfidenceLevel; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setConfidenceLevel((prev) => (prev === opt.id ? null : opt.id))
                        }
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          confidenceLevel === opt.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-slate-600 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 bg-slate-50 dark:bg-[#0B0D12] p-5 rounded-xl border border-slate-200 dark:border-[#222634]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Key takeaway
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {currentNode.summary}
                    </p>
                  </div>

                  {currentNode.content && currentNode.content !== currentNode.summary && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {currentNode.content}
                    </p>
                  )}

                  {currentNode.codeSnippet && (
                    <div className="p-3 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-lg text-xs italic text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Quote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{currentNode.codeSnippet}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-[#222634] pt-4 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>Reviews: {currentNode.srsData?.reps || 1}</span>
              <span>Interval: {currentNode.srsData?.intervalDays || 1}d</span>
              <span>Strength: {currentNode.srsData?.retentionScore}%</span>
            </div>
          </div>

          {isFlipped && (
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                How accurately did you recall it? (Keys 1–4)
              </span>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs font-medium">
                <button
                  onClick={() => handleRate(1)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <kbd className="font-mono text-[10px] opacity-70">1</kbd>
                  <span>Forgot · Reset</span>
                </button>
                <button
                  onClick={() => handleRate(2)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <kbd className="font-mono text-[10px] opacity-70">2</kbd>
                  <span>Hard · Soon</span>
                </button>
                <button
                  onClick={() => handleRate(3)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <kbd className="font-mono text-[10px] opacity-70">3</kbd>
                  <span>Got it (+20 XP)</span>
                </button>
                <button
                  onClick={() => handleRate(4)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <kbd className="font-mono text-[10px] opacity-70">4</kbd>
                  <span>Easy (+30 XP)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : method === 'cloze' ? (
        /* MODE 2: Fill-in-the-Blank Cloze */
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222634] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Generation Effect · Type or tap the missing keyword from memory
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {currentNode.title}
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              @{getCueSubject(currentNode)}
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            {clozeChallenge.masked}
          </div>

          {clozeChallenge.hints.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Word bank hints:</span>
              {clozeChallenge.hints.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setClozeInput(hint)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] hover:border-emerald-500 font-mono text-xs transition-colors cursor-pointer"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCheckCloze} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Type the missing term..."
              value={clozeInput}
              onChange={(e) => {
                setClozeInput(e.target.value);
                setClozeChecked(null);
              }}
              className="flex-1 h-10 px-4 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-sm font-mono"
            />
            <Button
              type="submit"
              disabled={!clozeInput.trim()}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
            >
              Check Answer
            </Button>
          </form>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {clozeChallenge.isCustom
              ? 'Custom {{bracket}} blank detected from your note.'
              : 'Tip: Wrap any word in {{brackets}} inside a note summary to choose your own blank.'}
          </p>

          {clozeChecked && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 ${
                clozeChecked === 'correct'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">
                  {clozeChecked === 'correct'
                    ? `Exact match! "${clozeChallenge.answer}"`
                    : `Expected "${clozeChallenge.answer}"`}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleRate(clozeChecked === 'correct' ? 4 : 2)}
                  className="rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <span>Save &amp; Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="leading-relaxed opacity-90">{currentNode.summary}</p>
            </div>
          )}
        </div>
      ) : method === 'scenario' ? (
        /* MODE 3: Real-World Scenario Challenge */
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#222634] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                Real-World Transfer · Apply the concept in context
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {currentNode.title}
              </h2>
            </div>

            {quota && (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#0B0D12] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222634] font-mono tabular-nums whitespace-nowrap">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>
                  AI checks today: {quota.remaining}/{quota.limit}
                </span>
              </div>
            )}
          </div>

          {!scenarioData ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-center space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Generate a quick practical question testing when and how to apply{' '}
                <strong className="text-slate-900 dark:text-white">{currentNode.title}</strong>.
              </p>
              {scenarioError && (
                <div className="max-w-md mx-auto p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scenarioError}</span>
                </div>
              )}
              <Button
                onClick={handleLoadScenario}
                disabled={scenarioLoading}
                className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Compass className={`w-4 h-4 ${scenarioLoading ? 'animate-spin' : ''}`} />
                <span>
                  {scenarioLoading
                    ? 'Building scenario...'
                    : scenarioError
                      ? 'Retry Practical Scenario'
                      : 'Start Practical Scenario'}
                </span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] space-y-2">
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {scenarioData.scenarioPrompt}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {scenarioData.question}
                </p>
              </div>

              <div className="space-y-2">
                {scenarioData.options.map((opt, idx) => {
                  const chosen = selectedScenarioIdx !== null;
                  const isCorrect = idx === scenarioData.correctIndex;
                  const isSelected = idx === selectedScenarioIdx;
                  return (
                    <button
                      key={idx}
                      disabled={chosen}
                      onClick={() => setSelectedScenarioIdx(idx)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-colors cursor-pointer ${
                        chosen
                          ? isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-medium'
                            : isSelected
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100'
                              : 'bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] opacity-60'
                          : 'bg-white dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] hover:border-violet-500'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selectedScenarioIdx !== null && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-900 dark:text-blue-200">
                      {selectedScenarioIdx === scenarioData.correctIndex
                        ? 'Spot on — practical recall locked in!'
                        : 'Good attempt — here is the key takeaway:'}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {scenarioData.explanation}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      handleRate(selectedScenarioIdx === scenarioData.correctIndex ? 4 : 2)
                    }
                    className="rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <span>Save &amp; Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* MODE 4: Feynman Teach-Back AI Concept Check (Strict 10-word / 6-unique minimum) */
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#222634] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Explain in plain words · Graded on genuine understanding
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {currentNode.title}
              </h2>
            </div>

            {quota && (
              <div
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#0B0D12] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222634] font-mono tabular-nums whitespace-nowrap"
                title="Shared demo AI quota resets daily; offline smart check activates automatically if reached."
              >
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>
                  AI checks today: {quota.remaining}/{quota.limit}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Explain this idea like you are teaching a curious friend (minimum 10 meaningful
                words):
              </label>
              <div className="flex items-center gap-2">
                {SpeechRecConstructor && (
                  <button
                    type="button"
                    onClick={handleToggleDictation}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isDictating
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-100 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-slate-700 dark:text-slate-300 hover:border-blue-400'
                    }`}
                    title={isDictating ? 'Stop voice dictation' : 'Speak your explanation aloud'}
                  >
                    {isDictating ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>{isDictating ? 'Stop Mic' : 'Speak Answer'}</span>
                  </button>
                )}
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    meetsWordRequirement
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {explanationStats.meaningfulCount}/10 words ({explanationStats.uniqueCount}/6
                  unique)
                </span>
              </div>
            </div>
            <Textarea
              rows={4}
              value={userExplanation}
              onChange={(e) => {
                setUserExplanation(e.target.value);
                setEvalError(null);
              }}
              placeholder="Write or speak at least one full sentence in your own words explaining how it works and why it matters..."
              className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-sm leading-relaxed"
            />
          </div>

          {evalError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{evalError}</span>
            </div>
          )}

          <Button
            onClick={handleEvaluateConcept}
            disabled={isEvaluating || !meetsWordRequirement}
            className="w-full h-10 rounded-xl text-sm font-semibold cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
            <span>
              {isEvaluating
                ? 'Checking your explanation...'
                : meetsWordRequirement
                  ? 'Check My Understanding'
                  : `Write ${Math.max(1, 10 - explanationStats.meaningfulCount)} more word(s) to evaluate`}
            </span>
          </Button>

          {evalResult && (
            <div className="bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] p-5 rounded-xl space-y-4 text-sm">
              {evalResult.quotaNotice && (
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-3 py-2 rounded-lg">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>{evalResult.quotaNotice}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222634] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span className="font-display font-bold text-base">
                    {evalResult.understood === false ? 'Almost there' : 'Core idea captured'}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-lg font-bold text-blue-600 dark:text-blue-400">
                  {evalResult.score}/100
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> What you got right
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed pl-5">
                  {evalResult.praise}
                </p>
              </div>

              {evalResult.missingAspects && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" /> One thing to sharpen
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed pl-5">
                    {evalResult.missingAspects}
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-[#13161F] p-3.5 rounded-xl border border-slate-200 dark:border-[#222634] space-y-1">
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 block">
                  Sticky analogy to remember
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {evalResult.simplifiedMetaphor}
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={() =>
                    handleRate(evalResult.score >= 80 ? 4 : evalResult.score >= 60 ? 3 : 2)
                  }
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <span>Save Score &amp; Next Card</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
