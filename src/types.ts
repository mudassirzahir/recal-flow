export type BrainRegion = 'prefrontal' | 'hippocampus' | 'neocortex' | 'amygdala' | 'cerebellum';

export type RelationshipType =
  'prerequisite' | 'consolidates_into' | 'analogy' | 'component' | 'associated_with';

export type NodeCategory = 'webdev' | 'psychology' | 'general' | 'todos' | 'insight';

export type SynapticStatus = 'active' | 'strengthening' | 'fading' | 'pruned';

export type ViewMode = 'today' | 'notes' | 'practice' | 'progress' | 'docs';

export type CueIconKey =
  | 'lightbulb'
  | 'book'
  | 'compass'
  | 'flame'
  | 'layers'
  | 'sparkles'
  | 'target'
  | 'bookmark'
  | 'code'
  | 'terminal';

export interface SRSData {
  stability: number;
  difficulty: number;
  reps: number;
  intervalDays: number;
  lastReviewedAt: string;
  nextReviewDate: string;
  retentionScore: number;
}

export interface ConceptNode {
  id: string;
  ownerId?: string;
  title: string;
  summary: string;
  content: string;
  category: NodeCategory;
  subject?: string;
  brainRegion: BrainRegion;
  cueIcon?: CueIconKey;
  cueColor?: string;
  srsData: SRSData;
  x: number;
  y: number;
  z?: number;
  status: 'encoding' | 'consolidating' | 'mastered' | 'fading';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  codeSnippet?: string;
}

export interface ConceptConnection {
  id: string;
  ownerId?: string;
  sourceId: string;
  targetId: string;
  relationship: RelationshipType;
  strength: number;
  synapticStatus: SynapticStatus;
  lastFiredAt?: string;
  label?: string;
}

export interface BrainRegionMeta {
  key: BrainRegion;
  name: string;
  everydaySubtitle: string;
  color: string;
  glowColor: string;
  description: string;
  cognitiveRole: string;
  idealFor: string;
  iconName: string;
}

export interface QuotaStatus {
  remaining: number;
  limit: number;
  resetAt: string;
  isConfigured: boolean;
}

export interface GamificationStats {
  xp: number;
  streakDays: number;
  lastPracticeDate: string;
  todayReviewedCount: number;
  dailyGoal: number;
  bestBlitzScore: number;
}

export interface WorkspacePreferences {
  subjects: string[];
  approvedTags: string[];
  staleLimit: number;
  enforceStaleGate: boolean;
  gamification?: GamificationStats;
}
