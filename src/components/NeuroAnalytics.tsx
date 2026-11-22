import React, { useMemo } from 'react';
import { ConceptNode, ConceptConnection, GamificationStats } from '../types';
import { BRAIN_REGIONS } from '../data/initialData';
import {
  isCueDue,
  isCueStale,
  getCueSubject,
  getLearnerLevel,
  getLocalDateKey
} from '../utils/dateFilters';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import {
  TrendingUp,
  ShieldCheck,
  Link2,
  Flame,
  Trophy,
  Gamepad2,
  Target,
  CalendarDays,
  CalendarClock
} from 'lucide-react';

interface NeuroAnalyticsProps {
  nodes: ConceptNode[];
  connections: ConceptConnection[];
  subjects: string[];
  gamification: GamificationStats;
  staleLimit: number;
  enforceStaleGate: boolean;
  onUpdateStaleSettings: (limit: number, enforce: boolean) => void;
  onUpdateDailyGoal: (goal: number) => void;
}

export const NeuroAnalytics: React.FC<NeuroAnalyticsProps> = ({
  nodes,
  connections,
  subjects,
  gamification,
  staleLimit,
  enforceStaleGate,
  onUpdateStaleSettings,
  onUpdateDailyGoal
}) => {
  const curveData = [
    { day: 'Day 0', noReview: 100, withSRS: 100 },
    { day: 'Day 1', noReview: 58, withSRS: 98 },
    { day: 'Day 3', noReview: 36, withSRS: 92 },
    { day: 'Day 7', noReview: 24, withSRS: 88 },
    { day: 'Day 14', noReview: 18, withSRS: 85 },
    { day: 'Day 21', noReview: 12, withSRS: 84 },
    { day: 'Day 30', noReview: 8, withSRS: 82 }
  ];

  const regionCounts = Object.keys(BRAIN_REGIONS).map((rKey) => {
    const meta = BRAIN_REGIONS[rKey];
    const count = nodes.filter((n) => n.brainRegion === rKey).length;
    return {
      name: meta.name,
      count,
      color: meta.color
    };
  });

  const subjectStats = Array.from(
    new Set([...subjects, ...nodes.map((n) => getCueSubject(n))])
  ).map((sub) => {
    const items = nodes.filter((n) => getCueSubject(n) === sub);
    const avg =
      items.length > 0
        ? Math.round(
            items.reduce((acc, i) => acc + (i.srsData?.retentionScore || 80), 0) / items.length
          )
        : 0;
    const due = items.filter((n) => isCueDue(n)).length;
    return { subject: sub, count: items.length, avg, due };
  });

  // Real 12-week (84-day) learning & practice activity heatmap built from user notes
  const { heatmapWeeks, activeDaysLast84, totalEventsLast84 } = useMemo(() => {
    const countsByDay = new Map<string, number>();

    nodes.forEach((n) => {
      const createdKey = getLocalDateKey(n.createdAt);
      if (createdKey) {
        countsByDay.set(createdKey, (countsByDay.get(createdKey) || 0) + 1);
      }
      const reviewedKey = n.srsData?.lastReviewedAt
        ? getLocalDateKey(n.srsData.lastReviewedAt)
        : '';
      if (reviewedKey && reviewedKey !== createdKey) {
        countsByDay.set(reviewedKey, (countsByDay.get(reviewedKey) || 0) + 1);
      }
    });

    const todayKey = getLocalDateKey();
    if (gamification.lastPracticeDate === todayKey && gamification.todayReviewedCount > 0) {
      countsByDay.set(
        todayKey,
        Math.max(countsByDay.get(todayKey) || 0, gamification.todayReviewedCount)
      );
    }

    const totalDays = 84;
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    const days: { dateKey: string; label: string; count: number }[] = [];
    let activeDays = 0;
    let totalEvents = 0;

    for (let offset = totalDays - 1; offset >= 0; offset--) {
      const d = new Date(base.getTime() - offset * 86400000);
      const key = getLocalDateKey(d);
      const count = countsByDay.get(key) || 0;
      if (count > 0) activeDays += 1;
      totalEvents += count;
      days.push({
        dateKey: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count
      });
    }

    const weeks: { dateKey: string; label: string; count: number }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return { heatmapWeeks: weeks, activeDaysLast84: activeDays, totalEventsLast84: totalEvents };
  }, [nodes, gamification.lastPracticeDate, gamification.todayReviewedCount]);

  // Real 7-day upcoming review workload forecast from srsData.nextReviewDate
  const upcomingForecast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;

    const buckets = Array.from({ length: 7 }, (_, i) => {
      const target = new Date(today.getTime() + i * dayMs);
      return {
        label:
          i === 0
            ? 'Today'
            : i === 1
              ? 'Tomorrow'
              : target.toLocaleDateString(undefined, { weekday: 'short' }),
        dateKey: getLocalDateKey(target),
        count: 0
      };
    });

    const keyToBucketIdx = new Map(buckets.map((b, idx) => [b.dateKey, idx]));

    nodes.forEach((n) => {
      if (isCueDue(n)) {
        buckets[0].count += 1;
        return;
      }
      const nextKey = n.srsData?.nextReviewDate ? getLocalDateKey(n.srsData.nextReviewDate) : '';
      const idx = keyToBucketIdx.get(nextKey);
      if (typeof idx === 'number') {
        buckets[idx].count += 1;
      }
    });

    return buckets;
  }, [nodes]);

  const totalNodes = nodes.length || 1;
  const avgRetention = Math.round(
    nodes.reduce((acc, n) => acc + (n.srsData?.retentionScore || 80), 0) / totalNodes
  );
  const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
  const staleCount = nodes.filter((n) => isCueStale(n)).length;

  const levelInfo = getLearnerLevel(gamification.xp);
  const todayKey = getLocalDateKey();
  const todayCount =
    gamification.lastPracticeDate === todayKey ? gamification.todayReviewedCount : 0;
  const dailyGoal = Math.max(1, gamification.dailyGoal || 5);
  const dailyPct = Math.min(100, Math.round((todayCount / dailyGoal) * 100));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
      {/* Gamification Hero Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Practice Streak
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {gamification.streakDays} day{gamification.streakDays === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Practice any card or Blitz round daily
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                Level {levelInfo.level} · {levelInfo.title}
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {gamification.xp} XP
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <Progress value={levelInfo.progressPct} className="w-full" />
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Best Quick Match Blitz
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {gamification.bestBlitzScore || 0} pts
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Personal high score in Practice Arena
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* KPI Row + Configurable Daily Goal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Avg. Memory Strength
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {avgRetention}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Core Mastery Earned
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400">
              {masteredCount} / {nodes.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Connected Links
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {connections.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Link2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              Daily Goal ({todayCount}/{dailyGoal})
            </span>
            <div className="flex items-center gap-1">
              {[3, 5, 10, 15].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onUpdateDailyGoal(g)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums cursor-pointer ${
                    dailyGoal === g
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-[#0B0D12] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <Progress value={dailyPct} className="w-full" />
        </div>
      </div>

      {/* Real Learning Activity Heatmap + 7-Day Review Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-[#222634] pb-3">
            <div>
              <h2 className="font-display font-bold text-base flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-emerald-500" />
                <span>12-Week Learning Activity</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Computed from your actual note captures and practice reviews
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
              {activeDaysLast84} active days · {totalEventsLast84} touchpoints
            </span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-grid grid-flow-col gap-1.5 min-w-max">
              {heatmapWeeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                  {week.map((day) => {
                    const shade =
                      day.count >= 4
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : day.count >= 2
                          ? 'bg-emerald-400/80 dark:bg-emerald-500/75'
                          : day.count === 1
                            ? 'bg-emerald-200 dark:bg-emerald-900/70'
                            : 'bg-slate-100 dark:bg-[#0B0D12] border border-slate-200/70 dark:border-[#222634]';
                    return (
                      <div
                        key={day.dateKey}
                        title={`${day.label}: ${day.count} learning event${day.count === 1 ? '' : 's'}`}
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs transition-colors ${shade}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Last 84 days</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]" />
              <span className="w-3 h-3 rounded-xs bg-emerald-200 dark:bg-emerald-900/70" />
              <span className="w-3 h-3 rounded-xs bg-emerald-400/80 dark:bg-emerald-500/75" />
              <span className="w-3 h-3 rounded-xs bg-emerald-500 dark:bg-emerald-400" />
              <span>More</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-200 dark:border-[#222634] pb-3">
            <h2 className="font-display font-bold text-base flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-blue-500" />
              <span>7-Day Review Forecast</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Scheduled SRS workload for the week ahead
            </p>
          </div>

          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={upcomingForecast} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13161F',
                    borderColor: '#222634',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F1F5F9'
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Forgetting Curve Chart */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-[#222634] pb-4">
          <div>
            <h2 className="font-display font-bold text-lg">
              Why Active Practice Beats Passive Notes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Expected recall over 30 days with spaced retrieval vs. reading notes once
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              With RecallFlow
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 opacity-70" />
              Passive notes
            </span>
          </div>
        </div>

        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSrsClean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorDecayClean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#13161F',
                  borderColor: '#222634',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#F1F5F9'
                }}
              />
              <Area
                type="monotone"
                dataKey="withSRS"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorSrsClean)"
              />
              <Area
                type="monotone"
                dataKey="noReview"
                stroke="#F43F5E"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorDecayClean)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom 2-Column: Automated Stages + Subject Mastery & Gate */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl space-y-4">
          <div className="border-b border-slate-200 dark:border-[#222634] pb-4">
            <h3 className="font-display font-bold text-lg">Automatic Memory Stages</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Stages advance automatically as you pass Practice drills and Blitz matches—never from
              saving notes alone
            </p>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#13161F',
                    borderColor: '#222634',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F1F5F9'
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {regionCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-display font-bold text-lg">Strength by @Subject</h3>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {subjectStats.map((st) => (
                <div
                  key={st.subject}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      @{st.subject}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {st.count} notes · {st.due} due
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400">
                    {st.count > 0 ? `${st.avg}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-[#222634] flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                Anti-Clutter Capture Gate ({staleCount}/{staleLimit})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Lock new captures when fading notes hit limit
              </span>
            </div>
            <Switch
              checked={enforceStaleGate}
              onCheckedChange={(checked) => onUpdateStaleSettings(staleLimit, checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
