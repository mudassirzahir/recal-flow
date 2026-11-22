import React, { useState, useMemo, useEffect } from 'react';
import { ConceptNode, ConceptConnection, BrainRegion, RelationshipType } from '../types';
import { BRAIN_REGIONS, CATEGORY_LABELS } from '../data/initialData';
import { CueIcon } from '../utils/cueIcons';
import {
  DateFilterKey,
  DATE_FILTER_OPTIONS,
  matchesDateFilter,
  formatRelativeDay,
  isCueDue,
  getCueSubject
} from '../utils/dateFilters';
import { ConnectMap } from './ConnectMap';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Presentation,
  Pencil,
  Trash2,
  Zap,
  Network,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Info,
  X,
  Quote,
  Link2,
  FolderKanban,
  LayoutGrid,
  Pin,
  FileDown,
  Share2
} from 'lucide-react';
import { shareNoteText } from '../utils/webShare';

export type VaultSubMode = 'cards' | 'slides' | 'map';

interface NotesLibraryProps {
  nodes: ConceptNode[];
  connections: ConceptConnection[];
  subjects: string[];
  subMode: VaultSubMode;
  onSubModeChange: (mode: VaultSubMode) => void;
  selectedNode: ConceptNode | null;
  onSelectNode: (node: ConceptNode | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onCreateConnection: (
    sourceId: string,
    targetId: string,
    relationship: RelationshipType,
    label: string
  ) => void;
  onDeleteConnection: (linkId: string) => void;
  onAutoLinkAll: () => void;
  isAutoLinking: boolean;
  onOpenQuickCapture: () => void;
  onOpenTaxonomyManager: () => void;
  onEditNode: (node: ConceptNode) => void;
  onDeleteNode: (id: string) => void;
  onPracticeNode: (node: ConceptNode) => void;
  onOpenOnMap: (node: ConceptNode) => void;
  pinnedIds?: string[];
  onTogglePin?: (id: string) => void;
  onExportMarkdown?: () => void;
  onShowToast?: (msg: string) => void;
}

type SortKey = 'newest' | 'weakest' | 'strongest';

export const NotesLibrary: React.FC<NotesLibraryProps> = ({
  nodes,
  connections,
  subjects,
  subMode,
  onSubModeChange,
  selectedNode,
  onSelectNode,
  onUpdateNodePosition,
  onCreateConnection,
  onDeleteConnection,
  onAutoLinkAll,
  isAutoLinking,
  onOpenQuickCapture,
  onOpenTaxonomyManager,
  onEditNode,
  onDeleteNode,
  onPracticeNode,
  onOpenOnMap,
  pinnedIds = [],
  onTogglePin,
  onExportMarkdown,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<BrainRegion | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [hideAnswers, setHideAnswers] = useState(false);

  // Recap Slides inline view state
  const [recapIndex, setRecapIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const handleShareNote = async (node: ConceptNode) => {
    const shareText = `${node.summary}${node.content && node.content !== node.summary ? `\n\n${node.content}` : ''}\n\nSubject: @${getCueSubject(node)}`;
    const outcome = await shareNoteText({
      title: node.title,
      text: shareText
    });
    if (outcome === 'shared') {
      onShowToast?.(`Shared "${node.title}"`);
    } else if (outcome === 'copied') {
      onShowToast?.(`Copied "${node.title}" to clipboard`);
    } else if (outcome === 'failed') {
      onShowToast?.('Could not share note from this browser');
    }
  };

  const allSubjects = useMemo(() => {
    const set = new Set<string>(subjects);
    nodes.forEach((n) => set.add(getCueSubject(n)));
    return Array.from(set);
  }, [subjects, nodes]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach((n) => (n.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [nodes]);

  const dateCounts = useMemo(() => {
    const map: Record<DateFilterKey, number> = {
      all: nodes.length,
      today: 0,
      yesterday: 0,
      week: 0,
      due: 0
    };
    DATE_FILTER_OPTIONS.forEach((opt) => {
      if (opt.key !== 'all') {
        map[opt.key] = nodes.filter((n) => matchesDateFilter(n, opt.key)).length;
      }
    });
    return map;
  }, [nodes]);

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = nodes.filter((n) => {
      if (pinnedOnly && !pinnedSet.has(n.id)) return false;
      if (!matchesDateFilter(n, dateFilter)) return false;
      if (subjectFilter !== 'all' && getCueSubject(n) !== subjectFilter) return false;
      if (stageFilter !== 'all' && n.brainRegion !== stageFilter) return false;
      if (tagFilter !== 'all' && !(n.tags || []).includes(tagFilter)) return false;

      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        getCueSubject(n).toLowerCase().includes(q) ||
        (n.codeSnippet || '').toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'weakest') {
        return (a.srsData?.retentionScore || 0) - (b.srsData?.retentionScore || 0);
      }
      if (sortBy === 'strongest') {
        return (b.srsData?.retentionScore || 0) - (a.srsData?.retentionScore || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    nodes,
    searchQuery,
    dateFilter,
    pinnedOnly,
    pinnedSet,
    subjectFilter,
    stageFilter,
    tagFilter,
    sortBy
  ]);

  const recapSlides = filteredNodes.length > 0 ? filteredNodes : nodes;
  const currentSlide = recapSlides[recapIndex % Math.max(1, recapSlides.length)];

  useEffect(() => {
    if (subMode !== 'slides' || !isAutoPlaying || recapSlides.length <= 1) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setRecapIndex((i) => (i + 1) % recapSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [subMode, isAutoPlaying, recapSlides.length]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isAutoPlaying) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsAutoPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isAutoPlaying]);

  useEffect(() => {
    if (subMode !== 'slides') {
      setIsAutoPlaying(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' && recapSlides.length > 0) {
        e.preventDefault();
        setRecapIndex((i) => (i + 1) % recapSlides.length);
      } else if (e.key === 'ArrowLeft' && recapSlides.length > 0) {
        e.preventDefault();
        setRecapIndex((i) => (i - 1 + recapSlides.length) % recapSlides.length);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsAutoPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subMode, recapSlides.length]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    dateFilter !== 'all' ||
    pinnedOnly ||
    subjectFilter !== 'all' ||
    stageFilter !== 'all' ||
    tagFilter !== 'all';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 text-slate-900 dark:text-slate-100">
      {/* Vault Header + Mode Switcher (Cards | Recap Slides | Connect Map) */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              Notes Vault
            </h1>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {nodes.length} note{nodes.length === 1 ? '' : 's'} · {connections.length} link
              {connections.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Browse your journal cards, skim calm Recap Slides, or link related ideas in the Connect
            Map.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 shrink-0">
          <Tabs
            value={subMode}
            onValueChange={(val) => {
              if (val === 'cards' || val === 'slides' || val === 'map') {
                onSubModeChange(val);
              }
            }}
          >
            <TabsList className="h-9 bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl p-1">
              <TabsTrigger
                value="cards"
                className="px-3 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Cards</span>
              </TabsTrigger>
              <TabsTrigger
                value="slides"
                className="px-3 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Presentation className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span>Recap Slides</span>
              </TabsTrigger>
              <TabsTrigger
                value="map"
                className="px-3 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Network className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Connect Map</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 shrink-0">
            {onExportMarkdown && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportMarkdown}
                className="h-9 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                title="Download notes as Markdown (.md)"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="hidden sm:inline">Export .md</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenTaxonomyManager}
              className="h-9 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              title="Manage Subjects & Tags"
            >
              <FolderKanban className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline">Subjects &amp; Tags</span>
            </Button>

            <Button
              size="sm"
              onClick={onOpenQuickCapture}
              className="h-9 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Quick Capture</span>
            </Button>
          </div>
        </div>
      </div>

      {/* MODE 3: EMBEDDED CONNECT MAP */}
      {subMode === 'map' && (
        <ConnectMap
          nodes={nodes}
          connections={connections}
          subjects={subjects}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onUpdateNodePosition={onUpdateNodePosition}
          onCreateConnection={onCreateConnection}
          onDeleteConnection={onDeleteConnection}
          onEditNode={onEditNode}
          onDeleteNode={onDeleteNode}
          onOpenLogger={onOpenQuickCapture}
          onPracticeNode={onPracticeNode}
          onAutoLinkAll={onAutoLinkAll}
          isAutoLinking={isAutoLinking}
          embedded
        />
      )}

      {/* Search & Multi-Facet Filter Bar (shown for Cards and Recap Slides) */}
      {subMode !== 'map' && (
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search titles, takeaways, @subjects, or #tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-10 pr-8 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                aria-label="Filter by subject"
                className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Subjects (@)</option>
                {allSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    @{sub}
                  </option>
                ))}
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as BrainRegion | 'all')}
                aria-label="Filter by memory stage"
                className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Stages</option>
                {Object.values(BRAIN_REGIONS).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All Tags (#)</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>

              {subMode === 'cards' && (
                <>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    aria-label="Sort notes"
                    className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="weakest">Needs Practice First</option>
                    <option value="strongest">Strongest Recall First</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setHideAnswers((v) => !v)}
                    className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] hover:bg-slate-100 dark:hover:bg-[#1B2030] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    title="Hide takeaways so you can test yourself as you scan"
                  >
                    {hideAnswers ? (
                      <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{hideAnswers ? 'Show Takeaways' : 'Hide Takeaways'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#222634]">
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_FILTER_OPTIONS.map((opt) => {
                const active = dateFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDateFilter(opt.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#222634]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[10px] ${active ? 'opacity-90' : 'opacity-65'}`}
                    >
                      {dateCounts[opt.key]}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => setPinnedOnly((p) => !p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  pinnedOnly
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#222634]'
                }`}
              >
                <Pin className="w-3 h-3" />
                <span>Pinned</span>
                <span className="font-mono tabular-nums text-[10px] opacity-80">
                  {pinnedIds.filter((id) => nodes.some((n) => n.id === id)).length}
                </span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                  setPinnedOnly(false);
                  setSubjectFilter('all');
                  setStageFilter('all');
                  setTagFilter('all');
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Reset filters ({filteredNodes.length}/{nodes.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE 1: CARDS GRID */}
      {subMode === 'cards' && (
        <>
          {filteredNodes.length === 0 ? (
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-10 text-center space-y-3">
              <p className="font-display font-bold text-base">No matching notes found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {hasActiveFilters
                  ? 'No saved notes match your active search or filters.'
                  : 'Capture your first 10-second learning note and it will appear right here.'}
              </p>
              <div className="pt-1 flex items-center justify-center gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setDateFilter('all');
                      setPinnedOnly(false);
                      setSubjectFilter('all');
                      setStageFilter('all');
                      setTagFilter('all');
                    }}
                    className="rounded-xl text-xs cursor-pointer"
                  >
                    Clear Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={onOpenQuickCapture}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  + Quick Capture
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNodes.map((node) => {
                const stageMeta = BRAIN_REGIONS[node.brainRegion];
                const accent = node.cueColor || stageMeta?.color || '#3B82F6';
                const linkCount = connections.filter(
                  (c) => c.sourceId === node.id || c.targetId === node.id
                ).length;
                const due = isCueDue(node);
                const score = node.srsData?.retentionScore || 80;
                const subjectLabel = getCueSubject(node);

                return (
                  <article
                    key={node.id}
                    className="min-w-0 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${accent}1E` }}
                          >
                            <CueIcon icon={node.cueIcon} className="w-4 h-4" color={accent} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              <button
                                onClick={() =>
                                  setSubjectFilter(
                                    subjectFilter === subjectLabel ? 'all' : subjectLabel
                                  )
                                }
                                className="font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                              >
                                @{subjectLabel}
                              </button>{' '}
                              · {formatRelativeDay(node.createdAt)}
                            </p>
                            <p
                              className="text-[11px] font-medium truncate"
                              style={{ color: stageMeta?.color }}
                            >
                              {stageMeta?.name || 'Fresh Notes'} ·{' '}
                              {CATEGORY_LABELS[node.category] || 'Note'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleShareNote(node)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-[#1B2030] transition-colors cursor-pointer"
                            title="Share or copy note"
                            aria-label="Share note"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          {onTogglePin && (
                            <button
                              onClick={() => onTogglePin(node.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                pinnedSet.has(node.id)
                                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-[#1B2030]'
                              }`}
                              title={
                                pinnedSet.has(node.id) ? 'Unpin note' : 'Pin note to Dashboard'
                              }
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditNode(node)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2030] transition-colors cursor-pointer"
                            title="Edit note"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteNode(node.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remove note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-white leading-snug">
                        {node.title}
                      </h3>

                      {hideAnswers ? (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500 py-2">
                          Takeaway hidden—recall the key point first, then toggle Show Takeaways.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                            {node.summary}
                          </p>
                          {node.content && node.content !== node.summary && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {node.content}
                            </p>
                          )}
                          {node.codeSnippet && (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-slate-700 dark:text-slate-300 rounded-lg text-[11px] flex items-center gap-1.5 truncate">
                              <Quote className="w-3 h-3 shrink-0 text-emerald-500" />
                              <span className="truncate italic">{node.codeSnippet}</span>
                            </div>
                          )}
                        </>
                      )}

                      {node.tags && node.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {node.tags.slice(0, 4).map((tag) => (
                            <button
                              key={tag}
                              onClick={() => setTagFilter(tagFilter === tag ? 'all' : tag)}
                              className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer ${
                                tagFilter === tag
                                  ? 'text-blue-600 dark:text-blue-400 font-semibold underline'
                                  : ''
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-[#222634] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        <span
                          className={
                            due
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          }
                        >
                          {score}%{due ? ' · Due' : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1" title="Connected ideas">
                          <Link2 className="w-3 h-3" />
                          {linkCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenOnMap(node)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1B2030] hover:bg-slate-200 dark:hover:bg-[#23293D] text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Inspect & link on Connect Map"
                        >
                          <Network className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                        <button
                          onClick={() => onPracticeNode(node)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Practice active recall now"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Practice</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODE 2: INLINE RECAP SLIDES DECK */}
      {subMode === 'slides' && (
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 bg-violet-50 dark:bg-violet-950/40 border-b border-violet-200 dark:border-violet-800/40 flex flex-wrap items-center justify-between gap-3 text-xs text-violet-900 dark:text-violet-200">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <span>
                <strong>Recap Presentation:</strong> Skimming slides refreshes your day calmly
                without altering review intervals or streaks.
              </span>
            </div>

            {recapSlides.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="font-mono tabular-nums">
                  Slide {(recapIndex % recapSlides.length) + 1} / {recapSlides.length}
                </span>
                <button
                  onClick={() => setIsAutoPlaying((p) => !p)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isAutoPlaying
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white dark:bg-[#0B0D12] border-violet-200 dark:border-[#222634] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isAutoPlaying ? 'Pause' : 'Auto-Play'}</span>
                </button>
              </div>
            )}
          </div>

          {currentSlide ? (
            <div className="p-6 sm:p-10 min-h-[340px] flex flex-col justify-between space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">
                  @{getCueSubject(currentSlide)} · {BRAIN_REGIONS[currentSlide.brainRegion]?.name} ·{' '}
                  {formatRelativeDay(currentSlide.createdAt)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums">
                    {currentSlide.srsData?.retentionScore || 80}% memory strength
                  </span>
                  <button
                    type="button"
                    onClick={() => handleShareNote(currentSlide)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Share this slide"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug text-balance">
                  {currentSlide.title}
                </h2>
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] space-y-2.5">
                  <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {currentSlide.summary}
                  </p>
                  {currentSlide.content && currentSlide.content !== currentSlide.summary && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {currentSlide.content}
                    </p>
                  )}
                </div>
                {currentSlide.codeSnippet && (
                  <div className="p-3.5 bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] rounded-xl text-xs italic text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Quote className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{currentSlide.codeSnippet}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-[#222634]">
                <Button
                  variant="outline"
                  onClick={() =>
                    setRecapIndex((i) => (i - 1 + recapSlides.length) % recapSlides.length)
                  }
                  disabled={recapSlides.length <= 1}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                <button
                  onClick={() => {
                    setIsAutoPlaying(false);
                    onPracticeNode(currentSlide);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Test Recall on This Note</span>
                </button>

                <Button
                  onClick={() => setRecapIndex((i) => (i + 1) % recapSlides.length)}
                  disabled={recapSlides.length <= 1}
                  className="rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-xs text-slate-500">
              No notes match the active filters to show as slides.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
