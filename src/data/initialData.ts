import { BrainRegionMeta, ConceptNode, ConceptConnection, CueIconKey } from '../types';

export const CUE_COLOR_SWATCHES: { id: string; label: string; hex: string }[] = [
  { id: 'blue', label: 'Cobalt', hex: '#3B82F6' },
  { id: 'emerald', label: 'Mint', hex: '#10B981' },
  { id: 'amber', label: 'Amber', hex: '#F59E0B' },
  { id: 'violet', label: 'Violet', hex: '#8B5CF6' },
  { id: 'rose', label: 'Coral', hex: '#F43F5E' }
];

export const CUE_ICON_OPTIONS: { key: CueIconKey; label: string }[] = [
  { key: 'lightbulb', label: 'Aha Cue' },
  { key: 'book', label: 'Reading' },
  { key: 'compass', label: 'Concept' },
  { key: 'target', label: 'Skill' },
  { key: 'flame', label: 'Important' },
  { key: 'layers', label: 'Pattern' },
  { key: 'sparkles', label: 'Insight' },
  { key: 'bookmark', label: 'Reference' }
];

export const DEFAULT_SUBJECTS: string[] = [
  'Learning & Mind',
  'Science & Nature',
  'Books & History',
  'Skills & Habits'
];

export const DEFAULT_APPROVED_TAGS: string[] = [
  'memory',
  'psychology',
  'science',
  'history',
  'habits',
  'communication',
  'cooking',
  'health',
  'feynman',
  'principles'
];

export const ANTI_PASSIVE_QUOTES: { quote: string; source: string }[] = [
  {
    quote:
      'Saving a note feels productive; retrieving it from memory is what actually rewires your brain.',
    source: 'Roediger & Karpicke · The Testing Effect'
  },
  {
    quote:
      'Never let an unreviewed backlog pile up—clear what is fading before adding another bookmark.',
    source: 'RecallFlow Active Rule'
  },
  {
    quote:
      'If you cannot explain an idea simply from memory, you collected a quote—not real understanding.',
    source: 'Richard Feynman Principle'
  },
  {
    quote:
      'Spacing practice right before an idea fades cuts total study time in half while doubling long-term recall.',
    source: 'Hermann Ebbinghaus · Spacing Curve'
  }
];

export const BRAIN_REGIONS: Record<string, BrainRegionMeta> = {
  hippocampus: {
    key: 'hippocampus',
    name: 'Fresh Notes',
    everydaySubtitle: 'Recently captured learnings',
    color: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    description:
      'Brand-new takeaways you just added—automatically placed here until your first practice pass.',
    cognitiveRole: 'Holds new entries automatically until active recall moves them forward.',
    idealFor: 'Daily journal captures, reading gems, and new discoveries.',
    iconName: 'Lightbulb'
  },
  prefrontal: {
    key: 'prefrontal',
    name: 'Active Focus',
    everydaySubtitle: 'Currently practicing',
    color: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    description: 'Ideas in active rotation—building strength as you test and connect them.',
    cognitiveRole: 'Keeps ideas you are actively sharpening ready for short-interval retrieval.',
    idealFor: 'Concepts currently in your weekly rotation.',
    iconName: 'Compass'
  },
  neocortex: {
    key: 'neocortex',
    name: 'Core Knowledge',
    everydaySubtitle: 'Long-term mastery earned',
    color: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.35)',
    description:
      'Earned automatically when you prove strong recall across spaced practice sessions.',
    cognitiveRole: 'Long-term concepts you can explain cleanly from memory.',
    idealFor: 'Mastered mental models and durable takeaways.',
    iconName: 'Layers'
  },
  amygdala: {
    key: 'amygdala',
    name: 'Key Takeaways',
    everydaySubtitle: 'High-impact breakthroughs',
    color: '#F43F5E',
    glowColor: 'rgba(244, 63, 94, 0.35)',
    description: 'Standout lessons and memorable moments worth revisiting regularly.',
    cognitiveRole: 'Highlights high-impact insights that connect across subjects.',
    idealFor: 'Surprising lessons and life takeaways.',
    iconName: 'Flame'
  },
  cerebellum: {
    key: 'cerebellum',
    name: 'Quick Habits',
    everydaySubtitle: 'Repeatable skills & cues',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    description: 'Practical habits, frameworks, and everyday heuristics you want on autopilot.',
    cognitiveRole: 'Builds effortless fluency through quick, varied repetition.',
    idealFor: 'Communication habits, study techniques, and daily routines.',
    iconName: 'Target'
  }
};

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'Everyday Notes',
  psychology: 'Books & Mind',
  insight: 'Aha Moments',
  todos: 'Action Habits',
  webdev: 'Skills & Tech'
};

const now = new Date().toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
const in3Days = new Date(Date.now() + 3 * 86400000).toISOString();
const in1Day = new Date(Date.now() + 86400000).toISOString();

export const INITIAL_NODES: ConceptNode[] = [
  {
    id: 'node-1',
    title: 'The Maillard Reaction',
    summary: 'Dry heat above 140°C turns sugars and amino acids into rich roasted flavor.',
    content:
      'When food hits a dry pan above 140°C (280°F), amino acids react with sugars to create hundreds of complex aroma compounds. Patting ingredients dry first prevents steam from trapping the temperature at 100°C.',
    category: 'insight',
    subject: 'Science & Nature',
    brainRegion: 'neocortex',
    cueIcon: 'flame',
    cueColor: '#F59E0B',
    srsData: {
      stability: 14,
      difficulty: 3,
      reps: 5,
      intervalDays: 7,
      lastReviewedAt: lastWeek,
      nextReviewDate: in3Days,
      retentionScore: 90
    },
    x: 420,
    y: 160,
    status: 'mastered',
    tags: ['science', 'cooking'],
    createdAt: lastWeek,
    updatedAt: lastWeek,
    codeSnippet: 'Dry surface + high heat = golden crust; wet pan = gray steam.'
  },
  {
    id: 'node-2',
    title: 'Spaced Repetition Timing',
    summary: 'Review right before an idea fades—each pass stretches the next break.',
    content:
      'Cramming the same page ten times in one evening fades within a week. Retrieving an idea just as it gets fuzzy (day 1, day 3, day 7, day 21) flattens the forgetting curve with far less total effort.',
    category: 'psychology',
    subject: 'Learning & Mind',
    brainRegion: 'prefrontal',
    cueIcon: 'compass',
    cueColor: '#10B981',
    srsData: {
      stability: 7,
      difficulty: 4,
      reps: 3,
      intervalDays: 4,
      lastReviewedAt: yesterday,
      nextReviewDate: in1Day,
      retentionScore: 81
    },
    x: 130,
    y: 180,
    status: 'consolidating',
    tags: ['memory', 'habits'],
    createdAt: twoHoursAgo,
    updatedAt: twoHoursAgo
  },
  {
    id: 'node-3',
    title: 'Explain-It-Simply (Feynman)',
    summary: 'Explaining a concept in plain everyday words exposes your exact blind spots.',
    content:
      'Pick any idea you just read, and explain it as if talking to a curious friend with zero jargon. Anywhere you pause or fall back on vague buzzwords shows the exact gap to revisit.',
    category: 'psychology',
    subject: 'Learning & Mind',
    brainRegion: 'hippocampus',
    cueIcon: 'lightbulb',
    cueColor: '#3B82F6',
    srsData: {
      stability: 4,
      difficulty: 5,
      reps: 2,
      intervalDays: 2,
      lastReviewedAt: yesterday,
      nextReviewDate: now,
      retentionScore: 73
    },
    x: 680,
    y: 310,
    status: 'encoding',
    tags: ['feynman', 'psychology'],
    createdAt: fourHoursAgo,
    updatedAt: fourHoursAgo,
    codeSnippet: '"If you cannot explain it simply, you do not understand it well enough."'
  },
  {
    id: 'node-4',
    title: "Gutenberg's Printing Breakthrough",
    summary: 'Combining alloy letters, oil ink, and a screw press cut book costs dramatically.',
    content:
      'Gutenberg did not invent printing from scratch—he combined reusable metal letter molds, thick oil-based ink that stuck to metal, and an adapted agricultural wine press into one scalable system around 1440.',
    category: 'general',
    subject: 'Books & History',
    brainRegion: 'hippocampus',
    cueIcon: 'book',
    cueColor: '#8B5CF6',
    srsData: {
      stability: 5,
      difficulty: 4,
      reps: 2,
      intervalDays: 3,
      lastReviewedAt: yesterday,
      nextReviewDate: now,
      retentionScore: 75
    },
    x: 150,
    y: 420,
    status: 'consolidating',
    tags: ['history', 'principles'],
    createdAt: yesterday,
    updatedAt: yesterday
  },
  {
    id: 'node-5',
    title: 'Looping Back in Conversation',
    summary: 'Reflect back what someone meant in your own words before offering your reply.',
    content:
      'In tough discussions, saying "So what matters most to you here is..." proves you actually heard them, lowers defensiveness, and catches misunderstandings before arguing past each other.',
    category: 'todos',
    subject: 'Skills & Habits',
    brainRegion: 'cerebellum',
    cueIcon: 'target',
    cueColor: '#10B981',
    srsData: {
      stability: 24,
      difficulty: 2,
      reps: 8,
      intervalDays: 21,
      lastReviewedAt: lastWeek,
      nextReviewDate: in3Days,
      retentionScore: 95
    },
    x: 720,
    y: 120,
    status: 'mastered',
    tags: ['communication', 'habits'],
    createdAt: threeDaysAgo,
    updatedAt: threeDaysAgo,
    codeSnippet: 'Try: "Let me check if I caught the core point..."'
  },
  {
    id: 'node-6',
    title: 'Morning Daylight & Sleep Clock',
    summary: '10 minutes of outdoor morning light anchors alertness and deeper night sleep.',
    content:
      'Natural daylight—even on an overcast morning—hits specialized retinal cells that start a circadian timer, boosting daytime cortisol focus and triggering melatonin release roughly 14–16 hours later.',
    category: 'insight',
    subject: 'Science & Nature',
    brainRegion: 'amygdala',
    cueIcon: 'sparkles',
    cueColor: '#F43F5E',
    srsData: {
      stability: 9,
      difficulty: 4,
      reps: 3,
      intervalDays: 5,
      lastReviewedAt: yesterday,
      nextReviewDate: now,
      retentionScore: 77
    },
    x: 420,
    y: 440,
    status: 'consolidating',
    tags: ['health', 'science'],
    createdAt: yesterday,
    updatedAt: yesterday
  }
];

export const INITIAL_CONNECTIONS: ConceptConnection[] = [
  {
    id: 'conn-1',
    sourceId: 'node-2',
    targetId: 'node-3',
    relationship: 'associated_with',
    strength: 0.85,
    synapticStatus: 'active',
    label: 'Stronger together'
  },
  {
    id: 'conn-2',
    sourceId: 'node-1',
    targetId: 'node-6',
    relationship: 'analogy',
    strength: 0.72,
    synapticStatus: 'active',
    label: 'Everyday science'
  },
  {
    id: 'conn-3',
    sourceId: 'node-3',
    targetId: 'node-5',
    relationship: 'associated_with',
    strength: 0.78,
    synapticStatus: 'active',
    label: 'Clarity in words'
  }
];
