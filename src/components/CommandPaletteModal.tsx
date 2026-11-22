import React, { useState, useEffect } from 'react';
import {
  Search,
  Zap,
  Plus,
  ArrowRight,
  Eye,
  BookOpen,
  Network,
  LayoutDashboard
} from 'lucide-react';
import { ConceptNode, ViewMode } from '../types';
import { BRAIN_REGIONS } from '../data/initialData';
import { getCueSubject } from '../utils/dateFilters';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: ConceptNode[];
  onSelectNode: (node: ConceptNode) => void;
  onPracticeNode?: (node: ConceptNode) => void;
  onViewChange: (view: ViewMode) => void;
  onOpenConnectMap: (node?: ConceptNode) => void;
  onToggleZenMode: () => void;
  onOpenLogger: () => void;
  onOpenDocs: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onSelectNode,
  onPracticeNode,
  onViewChange,
  onOpenConnectMap,
  onToggleZenMode,
  onOpenLogger,
  onOpenDocs
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase();
  const filteredNodes = nodes.filter(
    (node) =>
      node.title.toLowerCase().includes(q) ||
      node.summary.toLowerCase().includes(q) ||
      getCueSubject(node).toLowerCase().includes(q) ||
      node.tags.some((t) => t.toLowerCase().includes(q))
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100"
      >
        <div className="p-4 border-b border-slate-200 dark:border-[#222634] flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search your learning journal, @subjects, #tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none placeholder-slate-400"
          />
          <button
            onClick={onClose}
            className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1B2030] text-slate-500 text-[11px] font-mono"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-2 text-xs">
          {query.length < 3 && (
            <div className="p-1.5 space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block px-2 pb-1">
                Quick Actions
              </span>

              <button
                onClick={() => {
                  onViewChange('today');
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <LayoutDashboard className="w-4 h-4 text-blue-500" />
                  <span>Open Dashboard</span>
                </span>
                <span className="text-[11px] text-slate-400">All-in-one hub</span>
              </button>

              <button
                onClick={() => {
                  onOpenLogger();
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Plus className="w-4 h-4 text-blue-500" />
                  <span>Quick Capture (New Note)</span>
                </span>
                <span className="text-[11px] text-slate-400">10-sec entry</span>
              </button>

              <button
                onClick={() => {
                  onViewChange('practice');
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Open Practice Arena</span>
                </span>
                <span className="text-[11px] text-slate-400">Blitz, Cards &amp; AI</span>
              </button>

              <button
                onClick={() => {
                  onOpenConnectMap();
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Network className="w-4 h-4 text-emerald-500" />
                  <span>Open Connect Map in Vault</span>
                </span>
                <span className="text-[11px] text-slate-400">Explore links</span>
              </button>

              <button
                onClick={() => {
                  onToggleZenMode();
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Eye className="w-4 h-4 text-violet-500" />
                  <span>Enter Focus Mode</span>
                </span>
                <span className="text-[11px] text-slate-400">Distraction-free</span>
              </button>

              <button
                onClick={() => {
                  onOpenDocs();
                  onClose();
                }}
                className="w-full p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl flex items-center justify-between text-left transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <span>Open Guide &amp; Learning Science</span>
                </span>
                <span className="text-[11px] text-slate-400">Help</span>
              </button>
            </div>
          )}

          <div className="p-1.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-400 block px-2 pb-1">
              Saved Notes ({filteredNodes.length})
            </span>

            {filteredNodes.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No entries match &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filteredNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => {
                    onSelectNode(node);
                    onOpenConnectMap(node);
                    onClose();
                  }}
                  className="p-2.5 hover:bg-slate-100 dark:hover:bg-[#1B2030] rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{node.title}</span>
                      <span className="text-[11px] text-violet-600 dark:text-violet-400 shrink-0">
                        @{getCueSubject(node)}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
                        · {BRAIN_REGIONS[node.brainRegion]?.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {node.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onPracticeNode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPracticeNode(node);
                          onClose();
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Practice this note right now"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Practice</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(node);
                        onOpenConnectMap(node);
                        onClose();
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#0B0D12] hover:bg-slate-200 dark:hover:bg-[#222634] text-slate-700 dark:text-slate-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Locate on Connect Map"
                    >
                      <Network className="w-3 h-3" />
                      <span>Map</span>
                    </button>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 ml-0.5 hidden sm:block" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
