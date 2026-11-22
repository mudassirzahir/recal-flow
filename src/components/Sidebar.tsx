import React from 'react';
import {
  LayoutDashboard,
  BookText,
  Zap,
  BarChart3,
  Plus,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Compass,
  Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GamificationStats, ViewMode } from '../types';
import { getLearnerLevel } from '../utils/dateFilters';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenQuickCapture: () => void;
  onStartTour: () => void;
  dueCount: number;
  isCaptureLocked?: boolean;
  gamification: GamificationStats;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  currentView,
  onViewChange,
  onOpenQuickCapture,
  onStartTour,
  dueCount,
  isCaptureLocked = false,
  gamification
}) => {
  const navItems: {
    id: ViewMode;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'today',
      label: 'Dashboard',
      subtitle: 'Daily overview',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />
    },
    {
      id: 'notes',
      label: 'Notes Vault',
      subtitle: 'Cards, slides & map',
      icon: <BookText className="w-4 h-4 shrink-0" />
    },
    {
      id: 'practice',
      label: 'Practice',
      subtitle: 'Recall, Blitz & AI',
      icon: <Zap className="w-4 h-4 shrink-0" />,
      badge: dueCount
    },
    {
      id: 'progress',
      label: 'Progress',
      subtitle: 'Streaks & mastery',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />
    }
  ];

  const levelInfo = getLearnerLevel(gamification.xp);

  return (
    <aside
      className={`hidden md:flex sticky top-0 h-screen bg-white dark:bg-[#10131C] border-r border-slate-200 dark:border-[#222634] flex-col justify-between overflow-hidden transition-[width] duration-200 ease-out shrink-0 z-30 select-none ${
        isCollapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Top Section: Brand + Quick Capture CTA + Streamlined Nav */}
      <div className="p-3 space-y-4">
        <div className="h-11 flex items-center justify-between gap-1 overflow-hidden">
          <div
            className={`min-w-0 overflow-hidden transition-all duration-150 ${
              isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'flex-1 pl-1.5 opacity-100'
            }`}
          >
            <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap block">
              RecallFlow
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap block">
              Journal your learning
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-[44px] h-10 rounded-xl flex items-center justify-center shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2030] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Capture Action */}
        <Button
          type="button"
          onClick={onOpenQuickCapture}
          variant={isCaptureLocked ? 'outline' : 'default'}
          className={`w-full h-10 rounded-xl font-semibold text-xs px-0 overflow-hidden whitespace-nowrap cursor-pointer ${
            isCaptureLocked
              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              : 'shadow-sm shadow-blue-600/20'
          } justify-center gap-0`}
          title={
            isCaptureLocked
              ? 'Capture paused until stale notes are practiced'
              : 'Quick Capture (10 sec)'
          }
        >
          <span className="w-[44px] h-10 flex items-center justify-center shrink-0">
            {isCaptureLocked ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </span>
          <span
            className={`overflow-hidden transition-all duration-150 ${
              isCollapsed ? 'w-0 opacity-0' : 'pr-3 opacity-100'
            }`}
          >
            {isCaptureLocked ? 'Clear Stale First' : 'Quick Capture'}
          </span>
        </Button>

        {/* Unified 4-Tab Navigation — fixed 44px icon slot & 48px row height prevent jitter */}
        <nav aria-label="Workspace Navigation" className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full h-12 flex items-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap overflow-hidden cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B2030] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="w-[44px] h-12 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>

                <span
                  className={`flex-1 min-w-0 flex items-center justify-between gap-2 pr-2.5 transition-opacity duration-150 ${
                    isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <span className="flex flex-col items-start min-w-0">
                    <span className="font-medium truncate">{item.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
                      {item.subtitle}
                    </span>
                  </span>

                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200/80 dark:bg-[#222634] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Streak Widget & Walkthrough Trigger */}
      <div className="p-3 border-t border-slate-200 dark:border-[#222634] space-y-2">
        <button
          type="button"
          onClick={() => onViewChange('progress')}
          title={`${gamification.streakDays} day streak · ${gamification.xp} XP`}
          className={`w-full h-14 rounded-xl transition-colors overflow-hidden cursor-pointer ${
            isCollapsed
              ? 'flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#1B2030]'
              : 'p-2.5 bg-slate-50 dark:bg-[#161A26] border border-slate-200 dark:border-[#222634] hover:border-amber-400/50 text-left flex flex-col justify-between'
          }`}
        >
          {isCollapsed ? (
            <>
              <Flame className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-mono tabular-nums font-semibold">
                {gamification.streakDays}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs whitespace-nowrap">
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono tabular-nums">{gamification.streakDays}d</span> streak
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                  Lvl {levelInfo.level} · {gamification.xp} XP
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#222634] overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onStartTour}
          title={isCollapsed ? 'Quick Walkthrough' : undefined}
          className="w-full h-10 flex items-center rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B2030] hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap overflow-hidden cursor-pointer"
        >
          <span className="w-[44px] h-10 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-blue-500" />
          </span>
          <span
            className={`transition-opacity duration-150 ${
              isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pr-2'
            }`}
          >
            Walkthrough
          </span>
        </button>
      </div>
    </aside>
  );
};
