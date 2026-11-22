import {
  BrainRegion,
  ConceptConnection,
  ConceptNode,
  CueIconKey,
  NodeCategory,
  RelationshipType,
  SynapticStatus
} from '../types';

export interface ImportedWorkspaceResult {
  notes: ConceptNode[];
  links: ConceptConnection[];
  subjects: string[];
  approvedTags: string[];
  skippedDuplicates: number;
  summaryLabel: string;
}

const VALID_CATEGORIES = new Set<NodeCategory>([
  'webdev',
  'psychology',
  'general',
  'todos',
  'insight'
]);

const VALID_REGIONS = new Set<BrainRegion>([
  'prefrontal',
  'hippocampus',
  'neocortex',
  'amygdala',
  'cerebellum'
]);

const VALID_STATUSES = new Set<ConceptNode['status']>([
  'encoding',
  'consolidating',
  'mastered',
  'fading'
]);

const VALID_ICONS = new Set<CueIconKey>([
  'lightbulb',
  'book',
  'compass',
  'flame',
  'layers',
  'sparkles',
  'target',
  'bookmark',
  'code',
  'terminal'
]);

const VALID_RELATIONS = new Set<RelationshipType>([
  'prerequisite',
  'consolidates_into',
  'analogy',
  'component',
  'associated_with'
]);

const VALID_SYNAPTIC = new Set<SynapticStatus>(['active', 'strengthening', 'fading', 'pruned']);

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['imported'];
  const cleaned = raw
    .map((t) =>
      String(t || '')
        .trim()
        .toLowerCase()
        .replace(/^#+/, '')
        .slice(0, 40)
    )
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned)).slice(0, 10);
  return unique.length > 0 ? unique : ['imported'];
}

function sanitizeIso(raw: unknown, fallbackIso: string): string {
  if (typeof raw !== 'string') return fallbackIso;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallbackIso : parsed.toISOString();
}

function buildCueFromDraft(
  draft: {
    id?: unknown;
    title: unknown;
    summary: unknown;
    content?: unknown;
    subject?: unknown;
    category?: unknown;
    brainRegion?: unknown;
    cueIcon?: unknown;
    cueColor?: unknown;
    status?: unknown;
    tags?: unknown;
    codeSnippet?: unknown;
    x?: unknown;
    y?: unknown;
    srsData?: Record<string, unknown>;
    createdAt?: unknown;
    updatedAt?: unknown;
  },
  index: number,
  nowIso: string
): ConceptNode | null {
  const title = String(draft.title || '')
    .trim()
    .slice(0, 200);
  const rawSummary = String(draft.summary || '')
    .trim()
    .slice(0, 500);
  if (!title) return null;

  const summary = rawSummary || title;
  const content = String(draft.content || summary)
    .trim()
    .slice(0, 5000);
  const subject = String(draft.subject || 'General')
    .trim()
    .replace(/^@+/, '')
    .slice(0, 60);

  const category: NodeCategory = VALID_CATEGORIES.has(draft.category as NodeCategory)
    ? (draft.category as NodeCategory)
    : 'general';
  const brainRegion: BrainRegion = VALID_REGIONS.has(draft.brainRegion as BrainRegion)
    ? (draft.brainRegion as BrainRegion)
    : 'hippocampus';
  const status: ConceptNode['status'] = VALID_STATUSES.has(draft.status as ConceptNode['status'])
    ? (draft.status as ConceptNode['status'])
    : 'encoding';
  const cueIcon: CueIconKey = VALID_ICONS.has(draft.cueIcon as CueIconKey)
    ? (draft.cueIcon as CueIconKey)
    : 'book';

  const srs = draft.srsData || {};
  const idBase =
    typeof draft.id === 'string' && draft.id.trim()
      ? draft.id.trim().slice(0, 100)
      : `imp-${Date.now()}-${index}`;

  const createdAt = sanitizeIso(draft.createdAt, nowIso);
  const updatedAt = sanitizeIso(draft.updatedAt, createdAt);

  return {
    id: idBase,
    title,
    summary,
    content,
    category,
    subject: subject || 'General',
    brainRegion,
    cueIcon,
    cueColor:
      typeof draft.cueColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(draft.cueColor)
        ? draft.cueColor
        : '#3B82F6',
    status,
    tags: sanitizeTags(draft.tags),
    codeSnippet:
      typeof draft.codeSnippet === 'string' && draft.codeSnippet.trim()
        ? draft.codeSnippet.trim().slice(0, 5000)
        : '',
    x: clampNumber(draft.x, -50000, 50000, 120 + (index % 4) * 240),
    y: clampNumber(draft.y, -50000, 50000, 120 + Math.floor(index / 4) * 180),
    srsData: {
      stability: clampNumber(srs.stability, 0.1, 10000, 2.5),
      difficulty: clampNumber(srs.difficulty, 1, 10, 5),
      reps: Math.round(clampNumber(srs.reps, 0, 10000, 1)),
      intervalDays: Math.round(clampNumber(srs.intervalDays, 1, 36500, 1)),
      lastReviewedAt: sanitizeIso(srs.lastReviewedAt, createdAt),
      nextReviewDate: sanitizeIso(srs.nextReviewDate, nowIso),
      retentionScore: Math.round(clampNumber(srs.retentionScore, 0, 100, 72))
    },
    createdAt,
    updatedAt
  };
}

function parseJsonBackup(
  rawText: string,
  existingTitles: Set<string>,
  nowIso: string
): ImportedWorkspaceResult {
  const parsed = JSON.parse(rawText);
  const rawNotes: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.notes)
      ? parsed.notes
      : Array.isArray(parsed?.cues)
        ? parsed.cues
        : [];

  if (rawNotes.length === 0) {
    throw new Error('No notes found in JSON backup');
  }

  const seenTitles = new Set(existingTitles);
  const idMap = new Map<string, string>();
  const notes: ConceptNode[] = [];
  let skippedDuplicates = 0;

  rawNotes.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const normalizedTitle = String(obj.title || '')
      .trim()
      .toLowerCase();
    if (!normalizedTitle) return;

    if (seenTitles.has(normalizedTitle)) {
      skippedDuplicates += 1;
      return;
    }

    const oldId = typeof obj.id === 'string' ? obj.id : '';
    const uniqueId = `imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    const cue = buildCueFromDraft(
      {
        ...obj,
        id: uniqueId,
        title: obj.title,
        summary: obj.summary
      },
      idx,
      nowIso
    );

    if (cue) {
      seenTitles.add(normalizedTitle);
      if (oldId) idMap.set(oldId, cue.id);
      notes.push(cue);
    }
  });

  const rawLinks: unknown[] = Array.isArray(parsed?.links)
    ? parsed.links
    : Array.isArray(parsed?.connections)
      ? parsed.connections
      : [];

  const links: ConceptConnection[] = [];
  rawLinks.forEach((l, idx) => {
    if (!l || typeof l !== 'object') return;
    const obj = l as Record<string, unknown>;
    const mappedSource = idMap.get(String(obj.sourceId || ''));
    const mappedTarget = idMap.get(String(obj.targetId || ''));
    if (!mappedSource || !mappedTarget || mappedSource === mappedTarget) return;

    links.push({
      id: `link-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      sourceId: mappedSource,
      targetId: mappedTarget,
      relationship: VALID_RELATIONS.has(obj.relationship as RelationshipType)
        ? (obj.relationship as RelationshipType)
        : 'associated_with',
      strength: clampNumber(obj.strength, 0, 1, 0.85),
      synapticStatus: VALID_SYNAPTIC.has(obj.synapticStatus as SynapticStatus)
        ? (obj.synapticStatus as SynapticStatus)
        : 'strengthening',
      label: String(obj.label || 'Related')
        .trim()
        .slice(0, 60)
    });
  });

  const subjects: string[] = Array.isArray(parsed?.subjects)
    ? parsed.subjects
        .map((s: unknown) =>
          String(s || '')
            .trim()
            .replace(/^@+/, '')
            .slice(0, 60)
        )
        .filter(Boolean)
    : [];

  notes.forEach((n) => {
    if (n.subject && !subjects.includes(n.subject)) subjects.push(n.subject);
  });

  const approvedTags: string[] = Array.isArray(parsed?.approvedTags)
    ? parsed.approvedTags
        .map((t: unknown) =>
          String(t || '')
            .trim()
            .toLowerCase()
            .replace(/^#+/, '')
            .slice(0, 40)
        )
        .filter(Boolean)
    : [];

  return {
    notes,
    links,
    subjects: Array.from(new Set(subjects)).slice(0, 30),
    approvedTags: Array.from(new Set(approvedTags)).slice(0, 50),
    skippedDuplicates,
    summaryLabel: `Imported ${notes.length} note${notes.length === 1 ? '' : 's'}${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''}`
  };
}

function parseMarkdownOrText(
  rawText: string,
  existingTitles: Set<string>,
  nowIso: string
): ImportedWorkspaceResult {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const seenTitles = new Set(existingTitles);
  const notes: ConceptNode[] = [];
  const discoveredSubjects = new Set<string>();
  const discoveredTags = new Set<string>();
  let skippedDuplicates = 0;

  let currentSubject = 'General';
  let currentTitle = '';
  let bodyLines: string[] = [];

  const flushHeadingBlock = () => {
    if (!currentTitle) {
      bodyLines = [];
      return;
    }

    const normalizedTitle = currentTitle.trim().toLowerCase();
    if (seenTitles.has(normalizedTitle)) {
      skippedDuplicates += 1;
      currentTitle = '';
      bodyLines = [];
      return;
    }

    let summary = '';
    const detailParts: string[] = [];
    let quote = '';
    const blockTags: string[] = [];

    for (const rawLine of bodyLines) {
      const line = rawLine.trim();
      if (!line) continue;

      const takeawayMatch = line.match(/^-\s*\*\*Key Takeaway:\*\*\s*(.+)$/i);
      const detailsMatch = line.match(/^-\s*\*\*Details:\*\*\s*(.+)$/i);
      const quoteMatch = line.match(/^-\s*\*\*Quote \/ Reference:\*\*\s*>?\s*(.+)$/i);
      const tagsMatch = line.match(/^-\s*\*\*Tags:\*\*\s*(.+)$/i);
      const strengthMatch = line.match(/^-\s*\*\*Memory Strength:\*\*/i);

      if (takeawayMatch) {
        summary = takeawayMatch[1].trim();
      } else if (detailsMatch) {
        detailParts.push(detailsMatch[1].trim());
      } else if (quoteMatch) {
        quote = quoteMatch[1].trim();
      } else if (tagsMatch) {
        const matches: string[] = tagsMatch[1].match(/#[a-zA-Z0-9_-]+/g) || [];
        matches.forEach((m) => blockTags.push(m.replace(/^#+/, '').toLowerCase()));
      } else if (!strengthMatch) {
        detailParts.push(line.replace(/^[-*]\s+/, ''));
      }
    }

    if (!summary && detailParts.length > 0) {
      summary = detailParts[0];
    }

    const cue = buildCueFromDraft(
      {
        id: `imp-${Date.now()}-${notes.length}-${Math.random().toString(36).slice(2, 6)}`,
        title: currentTitle,
        summary: summary || currentTitle,
        content: detailParts.join(' ') || summary || currentTitle,
        subject: currentSubject,
        tags: blockTags.length > 0 ? blockTags : ['imported'],
        codeSnippet: quote
      },
      notes.length,
      nowIso
    );

    if (cue) {
      seenTitles.add(normalizedTitle);
      discoveredSubjects.add(currentSubject);
      cue.tags.forEach((t) => discoveredTags.add(t));
      notes.push(cue);
    }

    currentTitle = '';
    bodyLines = [];
  };

  for (const line of lines) {
    const subjectHeading = line.match(/^##\s+@(.+)$/);
    const subHeading = line.match(/^###\s+(.+)$/);
    const topHeading = line.match(/^#{1,2}\s+(?!@)(.+)$/);

    if (subjectHeading) {
      flushHeadingBlock();
      currentSubject = subjectHeading[1].trim().slice(0, 60) || 'General';
    } else if (subHeading) {
      flushHeadingBlock();
      currentTitle = subHeading[1].trim();
    } else if (topHeading) {
      // Skip the root export title "# RecallFlow Learning Journal (...)"
      if (!/^RecallFlow Learning Journal/i.test(topHeading[1])) {
        flushHeadingBlock();
        currentTitle = topHeading[1].trim();
      }
    } else if (currentTitle) {
      bodyLines.push(line);
    }
  }
  flushHeadingBlock();

  // Fallback parser for Q: / A: blocks or "Title :: Takeaway" lines when no headings exist
  if (notes.length === 0) {
    let pendingQ = '';
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const qaQuestion = trimmed.match(/^Q:\s*(.+)$/i);
      const qaAnswer = trimmed.match(/^A:\s*(.+)$/i);
      const colonPair = trimmed.match(/^(.{3,160}?)\s*::\s*(.{3,500})$/);

      if (qaQuestion) {
        pendingQ = qaQuestion[1].trim();
      } else if (qaAnswer && pendingQ) {
        const normalized = pendingQ.toLowerCase();
        if (seenTitles.has(normalized)) {
          skippedDuplicates += 1;
        } else {
          const cue = buildCueFromDraft(
            {
              id: `imp-${Date.now()}-${notes.length}`,
              title: pendingQ,
              summary: qaAnswer[1].trim(),
              subject: currentSubject
            },
            notes.length,
            nowIso
          );
          if (cue) {
            seenTitles.add(normalized);
            notes.push(cue);
          }
        }
        pendingQ = '';
      } else if (colonPair) {
        const normalized = colonPair[1].trim().toLowerCase();
        if (seenTitles.has(normalized)) {
          skippedDuplicates += 1;
        } else {
          const cue = buildCueFromDraft(
            {
              id: `imp-${Date.now()}-${notes.length}`,
              title: colonPair[1].trim(),
              summary: colonPair[2].trim(),
              subject: currentSubject
            },
            notes.length,
            nowIso
          );
          if (cue) {
            seenTitles.add(normalized);
            notes.push(cue);
          }
        }
      }
    }
  }

  if (notes.length === 0 && skippedDuplicates === 0) {
    throw new Error(
      'Could not find recognizable notes. Use JSON backup, Markdown headings (## / ###), Q:/A:, or "Title :: Takeaway".'
    );
  }

  return {
    notes,
    links: [],
    subjects: Array.from(discoveredSubjects),
    approvedTags: Array.from(discoveredTags),
    skippedDuplicates,
    summaryLabel: `Imported ${notes.length} note${notes.length === 1 ? '' : 's'}${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate skipped)` : ''}`
  };
}

export function parseImportedBackup(
  rawText: string,
  filename: string,
  existingNodes: ConceptNode[]
): ImportedWorkspaceResult {
  const existingTitles = new Set(existingNodes.map((n) => n.title.trim().toLowerCase()));
  const nowIso = new Date().toISOString();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error('The selected file is empty.');
  }

  const looksJson =
    filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (looksJson) {
    return parseJsonBackup(trimmed, existingTitles, nowIso);
  }

  return parseMarkdownOrText(trimmed, existingTitles, nowIso);
}
