import React from 'react';
import { LayoutDashboard, BookText, Plus, Lock, Zap, BarChart3 } from 'lucide-react';
import { ViewMode } from '../types';

interface MobileNavProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenQuickCapture: () => void;
  dueCount: number;
  isCaptureLocked?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onViewChange,
  onOpenQuickCapture,
  dueCount,
  isCaptureLocked = false
}) => {
  return (
    <nav
      aria-label="Mobile Workspace Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 dark:bg-[#10131C]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#222634] grid grid-cols-5 items-center px-1 select-none"
    >
      <button
        type="button"
        onClick={() => onViewChange('today')}
        className={`flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
          currentView === 'today'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Dashboard</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('notes')}
        className={`flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
          currentView === 'notes'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <BookText className="w-4 h-4" />
        <span>Vault</span>
      </button>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onOpenQuickCapture}
          aria-label={isCaptureLocked ? 'Capture paused' : 'Quick Capture'}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
            isCaptureLocked
              ? 'bg-amber-500 text-slate-950'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isCaptureLocked ? <Lock className="w-4 h-4" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onViewChange('practice')}
        className={`relative flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
          currentView === 'practice'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <div className="relative">
          <Zap className="w-4 h-4" />
          {dueCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-mono tabular-nums font-bold flex items-center justify-center">
              {dueCount > 99 ? '99+' : dueCount}
            </span>
          )}
        </div>
        <span>Practice</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('progress')}
        className={`flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
          currentView === 'progress'
            ? 'text-blue-600 dark:text-blue-400 font-semibold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Progress</span>
      </button>
    </nav>
  );
};
