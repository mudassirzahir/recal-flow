import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Sun,
  Moon,
  HelpCircle,
  Settings,
  LogIn,
  LogOut,
  Eye,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Upload,
  FileText,
  AlertCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ViewMode } from '../types';
import { ambientSynth } from '../utils/audioSynth';
import { PWAInstallButton } from './PWAInstallButton';

interface TopUtilityBarProps {
  currentView: ViewMode;
  vaultSubMode?: 'cards' | 'slides' | 'map';
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  onToggleFocusMode: () => void;
  onOpenDocs: () => void;
  user: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onResetWorkspace: () => void;
  onExportWorkspace: () => void;
  onExportMarkdown?: () => void;
  onImportNotes?: (file: File) => void;
  unsavedGuestCount: number;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  today: 'Dashboard',
  notes: 'Notes Vault',
  practice: 'Practice Arena',
  progress: 'Progress & Streaks',
  docs: 'Guide & Science'
};

const VAULT_SUBMODE_LABELS: Record<'cards' | 'slides' | 'map', string> = {
  cards: 'Cards',
  slides: 'Recap Slides',
  map: 'Connect Map'
};

export const TopUtilityBar: React.FC<TopUtilityBarProps> = ({
  currentView,
  vaultSubMode = 'cards',
  theme,
  onToggleTheme,
  onOpenCommandPalette,
  onToggleFocusMode,
  onOpenDocs,
  user,
  onOpenAuth,
  onSignOut,
  onResetWorkspace,
  onExportWorkspace,
  onExportMarkdown,
  onImportNotes,
  unsavedGuestCount
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [audioTrack, setAudioTrack] = useState<'off' | 'alpha' | 'pink'>('off');

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
        setIsAccountOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleAudio = (track: 'alpha' | 'pink' | 'off') => {
    if (track === 'off' || audioTrack === track) {
      ambientSynth.stop();
      setAudioTrack('off');
    } else if (track === 'alpha') {
      ambientSynth.startAlphaWaves(0.18);
      setAudioTrack('alpha');
    } else {
      ambientSynth.startPinkNoise(0.1);
      setAudioTrack('pink');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportNotes) {
      onImportNotes(file);
    }
    e.target.value = '';
    setIsSettingsOpen(false);
  };

  return (
    <header
      ref={containerRef}
      className="sticky top-0 z-30 h-14 px-4 sm:px-6 bg-white/95 dark:bg-[#0B0D12]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#222634] flex items-center justify-between gap-3 shrink-0"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md,.txt,application/json,text/markdown,text/plain"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Contextual Workspace Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <span className="md:hidden font-display font-bold text-sm text-slate-900 dark:text-white shrink-0">
          RecallFlow
        </span>
        <span className="md:hidden text-slate-300 dark:text-slate-700" aria-hidden="true">
          /
        </span>
        <span className="hidden md:inline text-slate-400 dark:text-slate-500 font-medium shrink-0">
          Workspace
        </span>
        <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
          /
        </span>
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
          {VIEW_LABELS[currentView]}
        </span>
        {currentView === 'notes' && (
          <>
            <span
              className="hidden sm:inline text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              /
            </span>
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400 shrink-0">
              {VAULT_SUBMODE_LABELS[vaultSubMode]}
            </span>
          </>
        )}
      </div>

      {/* Right Action Cluster */}
      <div className="flex items-center gap-2 shrink-0">
        {!user && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-xs font-medium text-amber-800 dark:text-amber-300 hover:border-amber-400/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Guest Preview Mode — Sign in to save your notes"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Preview{unsavedGuestCount > 0 ? ` (${unsavedGuestCount} unsaved)` : ''}</span>
          </button>
        )}

        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-50 dark:bg-[#13161F] border border-slate-200 dark:border-[#222634]">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1D2230] transition-colors cursor-pointer"
            title="Quick Search (⌘K)"
            aria-label="Quick Search"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleFocusMode}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1D2230] transition-colors cursor-pointer"
            title="Focus Mode"
            aria-label="Focus Mode"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1D2230] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <PWAInstallButton variant="compact" />

          <button
            type="button"
            onClick={onOpenDocs}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              currentView === 'docs'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1D2230]'
            }`}
            title="Guide & Memory Science"
            aria-label="Guide and Memory Science"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen((v) => !v);
                setIsAccountOpen(false);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isSettingsOpen
                  ? 'bg-slate-200/80 dark:bg-[#1D2230] text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#1D2230]'
              }`}
              title="Workspace Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 z-50 w-64 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-xl shadow-xl p-3 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Focus Sound</p>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#0B0D12] p-1 rounded-lg">
                    <button
                      onClick={() => handleAudio('off')}
                      className={`py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
                        audioTrack === 'off'
                          ? 'bg-white dark:bg-[#1D2230] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <VolumeX className="w-3 h-3" />
                      <span>Off</span>
                    </button>
                    <button
                      onClick={() => handleAudio('alpha')}
                      className={`py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
                        audioTrack === 'alpha'
                          ? 'bg-white dark:bg-[#1D2230] text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Calm</span>
                    </button>
                    <button
                      onClick={() => handleAudio('pink')}
                      className={`py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
                        audioTrack === 'pink'
                          ? 'bg-white dark:bg-[#1D2230] text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Rain</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-[#222634] pt-2 space-y-1">
                  <PWAInstallButton variant="menu-item" />

                  {onImportNotes && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B1F2C] text-slate-700 dark:text-slate-300 transition-colors text-left cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Import Backup / Notes</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onExportWorkspace();
                      setIsSettingsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B1F2C] text-slate-700 dark:text-slate-300 transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Cards (JSON)</span>
                  </button>
                  {onExportMarkdown && (
                    <button
                      onClick={() => {
                        onExportMarkdown();
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B1F2C] text-slate-700 dark:text-slate-300 transition-colors text-left cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export Journal (.md)</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onResetWorkspace();
                      setIsSettingsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B1F2C] text-slate-700 dark:text-slate-300 transition-colors text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Starter Examples</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-[#222634] mx-0.5" />

          {/* Login / Profile Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => {
                  setIsAccountOpen((v) => !v);
                  setIsSettingsOpen(false);
                }}
                className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1D2230] transition-colors whitespace-nowrap shrink-0"
                title={user.email || 'Account'}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[96px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </button>

              {isAccountOpen && (
                <div className="absolute right-0 mt-2 z-50 w-60 bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-xl shadow-xl p-3 space-y-2.5 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {user.displayName || 'Signed-in Learner'}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                      {user.emailVerified
                        ? 'Cloud sync active (Firebase)'
                        : 'Email verification pending'}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-[#222634] pt-2">
                    <button
                      onClick={() => {
                        setIsAccountOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              title="Sign In to Save"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
