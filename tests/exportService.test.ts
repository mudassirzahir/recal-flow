import { describe, it, expect } from 'vitest';
import { buildMarkdownJournal } from '../src/services/exportService';
import { INITIAL_NODES } from '../src/data/initialData';
import { DEFAULT_GAMIFICATION } from '../src/utils/dateFilters';

describe('exportService', () => {
  it('groups notes cleanly by @Subject in exported Markdown', () => {
    const md = buildMarkdownJournal(
      INITIAL_NODES,
      { ...DEFAULT_GAMIFICATION, xp: 120, streakDays: 3 },
      '2026-11-22'
    );
    expect(md).toContain('# RecallFlow Learning Journal (2026-11-22)');
    expect(md).toContain('Streak: 3 days | XP: 120');
    expect(md).toContain('## @Science & Nature');
    expect(md).toContain('## @Learning & Mind');
    expect(md).toContain('### The Maillard Reaction');
    expect(md).toContain('#cooking');
  });
});
