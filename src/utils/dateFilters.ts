import { ConceptNode, GamificationStats } from '../types';

export type DateFilterKey = 'all' | 'today' | 'yesterday' | 'week' | 'due';

export const DATE_FILTER_OPTIONS: { key: DateFilterKey; label: string }[] = [
  { key: 'all', label: 'All Days' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 Days' },
  { key: 'due', label: 'Due for Practice' }
];

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getLocalDateKey(dateInput: Date | string = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

export const DEFAULT_GAMIFICATION: GamificationStats = {
  xp: 0,
  streakDays: 0,
  lastPracticeDate: '',
  todayReviewedCount: 0,
  dailyGoal: 5,
  bestBlitzScore: 0
};

export function getLearnerLevel(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  const titles = [
    'Curious Beginner',
    'Daily Chronicler',
    'Active Thinker',
    'Idea Connector',
    'Memory Crafter',
    'Master Synthesizer'
  ];
  const level = Math.floor(safeXp / 150) + 1;
  const currentLevelXp = safeXp % 150;
  const nextLevelXp = 150;
  const progressPct = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));
  const title = titles[Math.min(titles.length - 1, level - 1)];
  return { level, title, currentLevelXp, nextLevelXp, progressPct };
}

export function applyPracticeGamification(
  prev: GamificationStats,
  earnedXp: number,
  reviewsCompleted = 1,
  blitzScore?: number
): GamificationStats {
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();

  const isSameDay = prev.lastPracticeDate === today;
  const isConsecutive = prev.lastPracticeDate === yesterday;

  let nextStreak = prev.streakDays;
  if (!isSameDay) {
    nextStreak = isConsecutive ? prev.streakDays + 1 : 1;
  } else if (nextStreak === 0 && reviewsCompleted > 0) {
    nextStreak = 1;
  }

  const nextTodayCount = isSameDay ? prev.todayReviewedCount + reviewsCompleted : reviewsCompleted;

  return {
    xp: Math.min(1000000, prev.xp + Math.max(0, earnedXp)),
    streakDays: Math.min(10000, nextStreak),
    lastPracticeDate: today,
    todayReviewedCount: Math.min(5000, nextTodayCount),
    dailyGoal: Math.min(50, Math.max(1, prev.dailyGoal || 5)),
    bestBlitzScore:
      typeof blitzScore === 'number'
        ? Math.max(prev.bestBlitzScore || 0, Math.min(100000, blitzScore))
        : prev.bestBlitzScore || 0
  };
}

export function isCueDue(node: ConceptNode): boolean {
  const nextReview = node.srsData?.nextReviewDate
    ? new Date(node.srsData.nextReviewDate).getTime()
    : Date.now();
  return nextReview <= Date.now() || (node.srsData?.retentionScore ?? 80) < 85;
}

export function isCueStale(node: ConceptNode): boolean {
  const score = node.srsData?.retentionScore ?? 80;
  const nextReview = node.srsData?.nextReviewDate
    ? new Date(node.srsData.nextReviewDate).getTime()
    : Date.now();
  const overdueHours = (Date.now() - nextReview) / 3600000;
  return (
    node.status === 'fading' ||
    score < 78 ||
    overdueHours >= 12 ||
    (score < 85 && nextReview <= Date.now())
  );
}

export function getCueSubject(node: ConceptNode): string {
  if (node.subject && node.subject.trim()) return node.subject.trim();
  switch (node.category) {
    case 'webdev':
      return 'Skills & Tech';
    case 'psychology':
      return 'Learning & Mind';
    case 'todos':
      return 'Skills & Habits';
    case 'insight':
      return 'Science & Nature';
    default:
      return 'Books & History';
  }
}

export function matchesDateFilter(node: ConceptNode, filter: DateFilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'due') return isCueDue(node);

  const createdMs = new Date(node.createdAt || node.updatedAt).getTime();
  if (Number.isNaN(createdMs)) return true;

  const todayStart = startOfLocalDay(new Date());
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  if (filter === 'today') {
    return createdMs >= todayStart;
  }
  if (filter === 'yesterday') {
    return createdMs >= yesterdayStart && createdMs < todayStart;
  }
  if (filter === 'week') {
    return createdMs >= weekStart;
  }
  return true;
}

export function formatRelativeDay(isoDate: string): string {
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return 'Recently';
  const todayStart = startOfLocalDay(new Date());
  const yesterdayStart = todayStart - 86400000;
  if (ms >= todayStart) return 'Today';
  if (ms >= yesterdayStart) return 'Yesterday';
  const days = Math.max(2, Math.floor((todayStart - ms) / 86400000) + 1);
  return `${days}d ago`;
}
