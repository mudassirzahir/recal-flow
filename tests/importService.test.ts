import { describe, it, expect } from 'vitest';
import { parseImportedBackup } from '../src/services/importService';
import { ConceptNode } from '../src/types';

const EXISTING_NODE: ConceptNode = {
  id: 'existing-1',
  title: 'Spacing Effect',
  summary: 'Reviews spaced over time beat cramming.',
  content: 'Detailed explanation.',
  category: 'psychology',
  subject: 'Learning & Mind',
  brainRegion: 'hippocampus',
  status: 'encoding',
  tags: ['memory'],
  x: 100,
  y: 100,
  srsData: {
    stability: 3,
    difficulty: 5,
    reps: 1,
    intervalDays: 1,
    lastReviewedAt: '2026-11-20T00:00:00.000Z',
    nextReviewDate: '2026-11-21T00:00:00.000Z',
    retentionScore: 80
  },
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z'
};

describe('parseImportedBackup', () => {
  it('imports valid JSON backup notes and links while skipping duplicates', () => {
    const payload = JSON.stringify({
      subjects: ['Philosophy', 'Psychology'],
      approvedTags: ['stoicism', 'habits'],
      notes: [
        {
          id: 'old-1',
          title: 'Spacing Effect',
          summary: 'Duplicate should be skipped'
        },
        {
          id: 'old-2',
          title: 'Premeditatio Malorum',
          summary: 'Visualizing obstacles ahead reduces anxiety and sharpens preparedness.',
          subject: '@Philosophy',
          tags: ['#Stoicism', 'Mindset']
        },
        {
          id: 'old-3',
          title: 'Dichotomy of Control',
          summary: 'Separate what depends on your choices from external events.',
          subject: 'Philosophy',
          tags: ['stoicism']
        }
      ],
      links: [
        {
          sourceId: 'old-2',
          targetId: 'old-3',
          relationship: 'associated_with',
          label: 'Stoic pair'
        }
      ]
    });

    const result = parseImportedBackup(payload, 'backup.json', [EXISTING_NODE]);

    expect(result.skippedDuplicates).toBe(1);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].subject).toBe('Philosophy');
    expect(result.notes[0].tags).toEqual(['stoicism', 'mindset']);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].sourceId).toBe(result.notes[0].id);
    expect(result.links[0].targetId).toBe(result.notes[1].id);
  });

  it('imports RecallFlow exported Markdown with subjects and tags', () => {
    const md = `# RecallFlow Learning Journal (2026-11-22)

## @Languages

### Spanish Subjunctive Triggers
- **Key Takeaway:** Use subjunctive after WEIRDO triggers like wishes and doubts.
- **Details:** Wishes, Emotions, Impersonal expressions, Recommendations, Doubt, Ojala.
- **Tags:** #spanish #grammar
`;

    const result = parseImportedBackup(md, 'journal.md', []);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].title).toBe('Spanish Subjunctive Triggers');
    expect(result.notes[0].subject).toBe('Languages');
    expect(result.notes[0].tags).toEqual(['spanish', 'grammar']);
  });

  it('imports Q:/A: and Title :: Takeaway plain text formats', () => {
    const txt = `Q: What is the Zeigarnik Effect?
A: Unfinished tasks stay active in working memory longer than completed ones.

Rule of Three :: Groups of three ideas feel complete and memorable.`;

    const result = parseImportedBackup(txt, 'flashcards.txt', []);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].title).toBe('What is the Zeigarnik Effect?');
    expect(result.notes[1].summary).toBe('Groups of three ideas feel complete and memorable.');
  });
});
