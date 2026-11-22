import { describe, it, expect } from 'vitest';
import {
  getLocalDateKey,
  getLearnerLevel,
  applyPracticeGamification,
  isCueDue,
  isCueStale,
  formatRelativeDay,
  DEFAULT_GAMIFICATION
} from '../src/utils/dateFilters';
import type { ConceptNode } from '../src/types';

function makeNode(overrides: Partial<ConceptNode> = {}): ConceptNode {
  const now = new Date().toISOString();
  return {
    id: 'test-1',
    title: 'Spaced Repetition',
    summary: 'Spacing recall builds long-term retention.',
    content: 'Spacing recall builds long-term retention.',
    category: 'psychology',
    subject: 'Learning & Mind',
    brainRegion: 'hippocampus',
    status: 'encoding',
    tags: ['memory'],
    x: 100,
    y: 100,
    createdAt: now,
    updatedAt: now,
    srsData: {
      stability: 3,
      difficulty: 5,
      reps: 1,
      intervalDays: 1,
      lastReviewedAt: now,
      nextReviewDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      retentionScore: 90
    },
    ...overrides
  };
}

describe('dateFilters utilities', () => {
  it('handles Date instances, ISO strings, and invalid values safely in getLocalDateKey', () => {
    expect(getLocalDateKey(new Date(2026, 10, 22))).toBe('2026-11-22');
    expect(getLocalDateKey('2026-11-22T12:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getLocalDateKey('not-a-date')).toBe('');
  });

  it('computes learner levels with safe lower bounds', () => {
    expect(getLearnerLevel(-10)).toMatchObject({ level: 1, currentLevelXp: 0, progressPct: 0 });
    expect(getLearnerLevel(150)).toMatchObject({ level: 2, currentLevelXp: 0, progressPct: 0 });
    expect(getLearnerLevel(225)).toMatchObject({ level: 2, currentLevelXp: 75, progressPct: 50 });
  });

  it('increments streak and daily count accurately', () => {
    const updated = applyPracticeGamification(DEFAULT_GAMIFICATION, 25, 1, 450);
    expect(updated.xp).toBe(25);
    expect(updated.streakDays).toBe(1);
    expect(updated.todayReviewedCount).toBe(1);
    expect(updated.bestBlitzScore).toBe(450);

    const sameDay = applyPracticeGamification(updated, 20, 1, 300);
    expect(sameDay.xp).toBe(45);
    expect(sameDay.streakDays).toBe(1);
    expect(sameDay.todayReviewedCount).toBe(2);
    expect(sameDay.bestBlitzScore).toBe(450);
  });

  it('detects due and stale notes accurately', () => {
    const fresh = makeNode();
    expect(isCueDue(fresh)).toBe(false);
    expect(isCueStale(fresh)).toBe(false);

    const overdue = makeNode({
      srsData: {
        stability: 3,
        difficulty: 5,
        reps: 1,
        intervalDays: 1,
        lastReviewedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        nextReviewDate: new Date(Date.now() - 3600000 * 14).toISOString(),
        retentionScore: 72
      }
    });
    expect(isCueDue(overdue)).toBe(true);
    expect(isCueStale(overdue)).toBe(true);
  });

  it('formats relative days gracefully', () => {
    expect(formatRelativeDay(new Date().toISOString())).toBe('Today');
    expect(formatRelativeDay('invalid')).toBe('Recently');
  });
});
