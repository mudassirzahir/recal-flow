import React, { useMemo } from 'react';
import { ConceptNode, ConceptConnection, GamificationStats, ViewMode } from '../types';
import { BRAIN_REGIONS } from '../data/initialData';
import {
  isCueDue,
  isCueStale,
  getCueSubject,
  formatRelativeDay,
  getLocalDateKey,
  matchesDateFilter
} from '../utils/dateFilters';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Zap,
  AlertTriangle,
  Network,
  Plus,
  Lock,
  Presentation,
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';

interface DashboardViewProps {
  nodes: ConceptNode[];
  connections: ConceptConnection[];
  subjects: string[];
  gamification: GamificationStats;
  staleLimit: number;
  enforceStaleGate: boolean;
  onPracticeNode: (node: ConceptNode) => void;
  onStartDuePractice: (subject?: string) => void;
  onOpenRecapSlides: () => void;
  onOpenOnMap: (node?: ConceptNode) => void;
  onOpenQuickCapture: () => void;
  onOpenTaxonomyManager: () => void;
  onNavigate: (view: ViewMode) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  nodes,
  connections,
  subjects,
  gamification,
  staleLimit,
  enforceStaleGate,
  onPracticeNode,
  onStartDuePractice,
  onOpenRecapSlides,
  onOpenOnMap,
  onOpenQuickCapture,
  onOpenTaxonomyManager,
  onNavigate
}) => {
  const dueNodes = useMemo(
    () =>
      nodes
        .filter((n) => isCueDue(n) || isCueStale(n))
        .sort((a, b) => (a.srsData?.retentionScore || 0) - (b.srsData?.retentionScore || 0)),
    [nodes]
  );

  const staleCount = useMemo(() => nodes.filter((n) => isCueStale(n)).length, [nodes]);
  const todayCapturedCount = useMemo(
    () => nodes.filter((n) => matchesDateFilter(n, 'today')).length,
    [nodes]
  );

  const unlinkedCount = useMemo(() => {
    const linkedIds = new Set<string>();
    connections.forEach((c) => {
      linkedIds.add(c.sourceId);
      linkedIds.add(c.targetId);
    });
    return nodes.filter((n) => !linkedIds.has(n.id)).length;
  }, [nodes, connections]);

  const isGateTriggered = enforceStaleGate && staleCount >= staleLimit;

  const avgStrength = useMemo(() => {
    if (nodes.length === 0) return 0;
    const sum = nodes.reduce((acc, n) => acc + (n.srsData?.retentionScore || 80), 0);
    return Math.round(sum / nodes.length);
  }, [nodes]);

  const todayKey = getLocalDateKey();
  const todayPracticed =
    gamification.lastPracticeDate === todayKey ? gamification.todayReviewedCount : 0;
  const dailyGoal = Math.max(1, gamification.dailyGoal || 5);
  const dailyGoalPct = Math.min(100, Math.round((todayPracticed / dailyGoal) * 100));

  const upNextNodes = useMemo(() => {
    const source = dueNodes.length > 0 ? dueNodes : nodes;
    return source.slice(0, 5);
  }, [dueNodes, nodes]);

  const subjectSummaries = useMemo(() => {
    const map = new Map<string, { total: number; due: number; avgScore: number }>();
    subjects.forEach((s) => map.set(s, { total: 0, due: 0, avgScore: 0 }));

    nodes.forEach((n) => {
      const sub = getCueSubject(n);
      const curr = map.get(sub) || { total: 0, due: 0, avgScore: 0 };
      curr.total += 1;
      if (isCueDue(n)) curr.due += 1;
      curr.avgScore += n.srsData?.retentionScore || 80;
      map.set(sub, curr);
    });

    return Array.from(map.entries()).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      due: stats.due,
      avgScore: stats.total > 0 ? Math.round(stats.avgScore / stats.total) : 0
    }));
  }, [nodes, subjects]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
      {/* 1. DAILY BRIEFING HEADER */}
      <section className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">Daily Overview</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{todayCapturedCount} captured today</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{gamification.streakDays}d streak</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              {dueNodes.length > 0
                ? `${dueNodes.length} note${dueNodes.length === 1 ? '' : 's'} ready for recall today`
                : 'You are all caught up for today'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => onStartDuePractice()}
              disabled={nodes.length === 0}
              className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>
                {dueNodes.length > 0 ? `Practice ${dueNodes.length} Due` : 'Open Practice'}
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={onOpenQuickCapture}
              className="h-10 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGateTriggered ? (
                <Lock className="w-4 h-4 text-rose-500" />
              ) : (
                <Plus className="w-4 h-4 text-blue-500" />
              )}
              <span>{isGateTriggered ? 'Capture Paused' : 'Quick Capture'}</span>
            </Button>

            <Button
              variant="outline"
              onClick={onOpenRecapSlides}
              disabled={nodes.length === 0}
              className="h-10 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Presentation className="w-4 h-4 text-violet-500" />
              <span>Recap Slides</span>
            </Button>
          </div>
        </div>

        {isGateTriggered && (
          <div className="pt-3 border-t border-slate-100 dark:border-[#222634] flex flex-wrap items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Capture is paused because{' '}
                <strong className="font-mono tabular-nums">
                  {staleCount}/{staleLimit}
                </strong>{' '}
                notes are fading. Practice one note to unlock new captures.
              </span>
            </span>
            <button
              onClick={() => onStartDuePractice()}
              className="font-semibold underline whitespace-nowrap cursor-pointer"
            >
              Practice 1 fading note
            </button>
          </div>
        )}
      </section>

      {/* 2. AT-A-GLANCE METRICS STRIP */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Due Queue</span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {dueNodes.length}
              </span>
              <span
                className={`text-xs font-mono tabular-nums ${
                  staleCount > 0
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {staleCount > 0 ? `${staleCount} fading` : 'None fading'}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#222634] flex justify-end">
            <button
              type="button"
              onClick={() => onStartDuePractice()}
              disabled={nodes.length === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Practice queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Daily Goal</span>
              <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                {todayPracticed}/{dailyGoal}
              </span>
            </div>
            <Progress value={dailyGoalPct} className="w-full" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#222634] flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('progress')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>View progress</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Memory Strength
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {avgStrength}%
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {nodes.length} notes
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#222634] flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('progress')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Analytics</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Knowledge Links</span>
              <Network className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {connections.length}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {unlinkedCount} unlinked
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#222634] flex justify-end">
            <button
              type="button"
              onClick={() => onOpenOnMap()}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Connect Map</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. FOCUSED DAILY WORKSPACE: UP NEXT + SUBJECTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT (7 cols): UP NEXT QUEUE */}
        <section className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#222634]">
              <div>
                <h2 className="font-display font-bold text-base">
                  {dueNodes.length > 0 ? 'Up Next to Practice' : 'Recent Notes'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {dueNodes.length > 0
                    ? 'Lowest retention notes appear first'
                    : 'Your queue is clear — revisit any note or add a new one'}
                </p>
              </div>
              <button
                onClick={() => onNavigate('notes')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upNextNodes.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your learning journal is empty.
                </p>
                <Button
                  size="sm"
                  onClick={onOpenQuickCapture}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Capture First Note</span>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#222634]">
                {upNextNodes.map((node) => {
                  const score = node.srsData?.retentionScore || 80;
                  const stageName = BRAIN_REGIONS[node.brainRegion]?.name || 'Fresh Notes';
                  return (
                    <li
                      key={node.id}
                      className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#181C28]/60 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {node.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            @{getCueSubject(node)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{stageName}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono tabular-nums ${
                              isCueStale(node)
                                ? 'text-rose-600 dark:text-rose-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {score}%
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeDay(node.createdAt)}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isCueDue(node) ? 'default' : 'outline'}
                        onClick={() => onPracticeNode(node)}
                        className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Practice
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* RIGHT (5 cols): SUBJECTS SNAPSHOT */}
        <section className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#222634]">
              <div>
                <h2 className="font-display font-bold text-base">Subjects</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Focus practice one topic at a time
                </p>
              </div>
              <button
                onClick={onOpenTaxonomyManager}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Manage</span>
              </button>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-[#222634] max-h-[300px] overflow-y-auto">
              {subjectSummaries.map((item) => (
                <li
                  key={item.subject}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
                      @{item.subject}
                    </p>
                    <p className="font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.total === 0
                        ? 'No notes yet'
                        : `${item.total} note${item.total === 1 ? '' : 's'} · ${item.avgScore}% avg`}
                    </p>
                  </div>

                  {item.due > 0 ? (
                    <button
                      onClick={() => onStartDuePractice(item.subject)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      Practice ({item.due})
                    </button>
                  ) : item.total > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap shrink-0">
                      Fresh
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-[#222634] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Explore visual connections</span>
            <button
              onClick={() => onOpenOnMap()}
              className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Connect Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
