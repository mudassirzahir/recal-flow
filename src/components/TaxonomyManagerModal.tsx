import React, { useState } from 'react';
import { ConceptNode } from '../types';
import { getCueSubject } from '../utils/dateFilters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2, FolderKanban, Hash, ShieldAlert } from 'lucide-react';

interface TaxonomyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: string[];
  approvedTags: string[];
  nodes: ConceptNode[];
  onAddSubject: (subject: string) => void;
  onRemoveSubject: (subject: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export const TaxonomyManagerModal: React.FC<TaxonomyManagerModalProps> = ({
  isOpen,
  onClose,
  subjects,
  approvedTags,
  nodes,
  onAddSubject,
  onRemoveSubject,
  onAddTag,
  onRemoveTag
}) => {
  const [newSubject, setNewSubject] = useState('');
  const [newTag, setNewTag] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newSubject.trim().replace(/^@+/, '');
    if (!cleaned) return;
    if (subjects.some((s) => s.toLowerCase() === cleaned.toLowerCase())) {
      setErrorMsg(`Subject "@${cleaned}" already exists.`);
      return;
    }
    if (subjects.length >= 30) {
      setErrorMsg('You can keep up to 30 subjects to avoid clutter.');
      return;
    }
    onAddSubject(cleaned);
    setNewSubject('');
    setErrorMsg('');
  };

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTag
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!cleaned) return;
    if (approvedTags.some((t) => t.toLowerCase() === cleaned)) {
      setErrorMsg(`Tag "#${cleaned}" already exists.`);
      return;
    }
    if (approvedTags.length >= 50) {
      setErrorMsg('You can keep up to 50 approved tags.');
      return;
    }
    onAddTag(cleaned);
    setNewTag('');
    setErrorMsg('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-0 overflow-hidden rounded-2xl max-h-[88vh] flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-[#222634] pr-12">
          <DialogTitle className="font-display font-bold text-base text-slate-900 dark:text-white">
            Manage Subjects (@) &amp; Tags (#)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Add your subjects and tags intentionally here so Quick Capture stays clean and focused.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-6 text-xs flex-1">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Typing <code className="font-mono font-semibold">@</code> or{' '}
              <code className="font-mono font-semibold">#</code> in Quick Capture opens a
              Notion-style popover picking from this curated list—preventing tag sprawl.
            </span>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Subjects Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-bold text-sm">
                <FolderKanban className="w-4 h-4 text-blue-500" />
                <span>Subjects ({subjects.length}/30)</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Keeps separate subjects unmixed
              </span>
            </div>

            <form onSubmit={handleCreateSubject} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="e.g. Cooking, Spanish, World History, Photography"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newSubject.trim()}
                className="h-9 rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </Button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {subjects.map((sub) => {
                const count = nodes.filter(
                  (n) => getCueSubject(n).toLowerCase() === sub.toLowerCase()
                ).length;
                return (
                  <div
                    key={sub}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        @{sub}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {count} note{count === 1 ? '' : 's'}
                      </span>
                    </div>
                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveSubject(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title={`Remove @${sub}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Approved Tags Section */}
          <section className="space-y-3 border-t border-slate-200 dark:border-[#222634] pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-bold text-sm">
                <Hash className="w-4 h-4 text-emerald-500" />
                <span>Approved Tags ({approvedTags.length}/50)</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Suggested when you type #
              </span>
            </div>

            <form onSubmit={handleCreateTag} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="e.g. biology, economics, nutrition, storytelling"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newTag.trim()}
                className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tag</span>
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {approvedTags.map((tag) => {
                const count = nodes.filter((n) => (n.tags || []).includes(tag)).length;
                return (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634]"
                  >
                    <span className="font-mono text-slate-800 dark:text-slate-200">#{tag}</span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      ({count})
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title={`Remove #${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#222634] flex justify-end">
          <Button onClick={onClose} className="rounded-xl text-xs font-semibold cursor-pointer">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
