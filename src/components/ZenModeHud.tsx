import React, { useState } from 'react';
import { Maximize, Minimize, Volume2, BookText, Zap, X, LayoutDashboard } from 'lucide-react';
import { ViewMode } from '../types';
import { ambientSynth } from '../utils/audioSynth';

interface ZenModeHudProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onExitZenMode: () => void;
}

export const ZenModeHud: React.FC<ZenModeHudProps> = ({
  currentView,
  onViewChange,
  onExitZenMode
}) => {
  const [audioTrack, setAudioTrack] = useState<'off' | 'alpha' | 'pink'>('off');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleAudio = (track: 'alpha' | 'pink') => {
    if (audioTrack === track) {
      ambientSynth.stop();
      setAudioTrack('off');
    } else {
      if (track === 'alpha') {
        ambientSynth.startAlphaWaves(0.18);
      } else {
        ambientSynth.startPinkNoise(0.1);
      }
      setAudioTrack(track);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 dark:bg-[#13161F]/95 backdrop-blur-xl border border-slate-200 dark:border-[#222634] p-1.5 rounded-2xl shadow-lg text-xs text-slate-900 dark:text-slate-100">
      <span className="px-2.5 py-1 font-display font-semibold text-xs whitespace-nowrap">
        Focus Mode
      </span>

      <div className="flex items-center bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-xl border border-slate-200 dark:border-[#222634]">
        <button
          onClick={() => onViewChange('today')}
          className={`p-1.5 rounded-lg transition-colors ${
            currentView === 'today'
              ? 'bg-white dark:bg-[#1B2030] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewChange('notes')}
          className={`p-1.5 rounded-lg transition-colors ${
            currentView === 'notes'
              ? 'bg-white dark:bg-[#1B2030] text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Notes Vault"
        >
          <BookText className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewChange('practice')}
          className={`p-1.5 rounded-lg transition-colors ${
            currentView === 'practice'
              ? 'bg-white dark:bg-[#1B2030] text-amber-600 dark:text-amber-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Practice"
        >
          <Zap className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-[#0B0D12] p-0.5 rounded-xl border border-slate-200 dark:border-[#222634]">
        <button
          onClick={() => toggleAudio('alpha')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
            audioTrack === 'alpha'
              ? 'bg-white dark:bg-[#1B2030] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Calm</span>
        </button>

        <button
          onClick={() => toggleAudio('pink')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
            audioTrack === 'pink'
              ? 'bg-white dark:bg-[#1B2030] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Rain</span>
        </button>
      </div>

      <button
        onClick={toggleFullscreen}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      <button
        onClick={() => {
          ambientSynth.stop();
          onExitZenMode();
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
      >
        <X className="w-3.5 h-3.5" />
        <span>Exit</span>
      </button>
    </div>
  );
};
