import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrainRegion, NodeCategory, ConceptNode, CueIconKey } from '../types';
import { BRAIN_REGIONS, CUE_COLOR_SWATCHES, CUE_ICON_OPTIONS } from '../data/initialData';
import { getCueSubject } from '../utils/dateFilters';
import { CueIcon } from '../utils/cueIcons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Quote,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Zap,
  FolderKanban,
  Hash,
  Settings2,
  Check,
  AlertCircle
} from 'lucide-react';

interface EncounterLoggerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNode: (node: Omit<ConceptNode, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingNode?: ConceptNode | null;
  onUpdateNode?: (node: ConceptNode) => void;
  userId?: string | null;
  subjects: string[];
  approvedTags: string[];
  onOpenTaxonomyManager: () => void;
  isCaptureLocked?: boolean;
  staleNodes?: ConceptNode[];
  staleLimit?: number;
  onPracticeNode?: (node: ConceptNode) => void;
  onDisableStaleGate?: () => void;
}

export const EncounterLogger: React.FC<EncounterLoggerProps> = ({
  isOpen,
  onClose,
  onSaveNode,
  editingNode,
  onUpdateNode,
  userId,
  subjects,
  approvedTags,
  onOpenTaxonomyManager,
  isCaptureLocked = false,
  staleNodes = [],
  staleLimit = 5,
  onPracticeNode,
  onDisableStaleGate
}) => {
  const isEditing = Boolean(editingNode);

  // Core journal capture fields
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [subject, setSubject] = useState<string>(subjects[0] || 'Learning & Mind');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cueIcon, setCueIcon] = useState<CueIconKey>('lightbulb');
  const [cueColor, setCueColor] = useState<string>('#3B82F6');

  // Popover control states
  const [subjectPopoverOpen, setSubjectPopoverOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [subjectFilterQuery, setSubjectFilterQuery] = useState('');
  const [tagFilterQuery, setTagFilterQuery] = useState('');

  // Optional context drawer (no manual memory-stage or cue-type selectors)
  const [showDetails, setShowDetails] = useState(false);
  const [content, setContent] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');

  // Internal stage/category (managed automatically by RecallFlow spaced practice)
  const [internalCategory, setInternalCategory] = useState<NodeCategory>('general');
  const [internalStage, setInternalStage] = useState<BrainRegion>('hippocampus');

  const [isOrganizing, setIsOrganizing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiError, setAiError] = useState('');

  // Floating inline @Subject / #Tag autocomplete inside Title or Summary
  const [activeField, setActiveField] = useState<'title' | 'summary' | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const summaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSubjectPopoverOpen(false);
      setTagPopoverOpen(false);
      setActiveField(null);
      return;
    }

    if (editingNode) {
      setTitle(editingNode.title || '');
      setSummary(editingNode.summary || '');
      setSubject(getCueSubject(editingNode));
      setSelectedTags(editingNode.tags || []);
      setCueIcon(editingNode.cueIcon || 'lightbulb');
      setCueColor(
        editingNode.cueColor || BRAIN_REGIONS[editingNode.brainRegion]?.color || '#3B82F6'
      );
      setContent(editingNode.content || '');
      setInternalCategory(editingNode.category || 'general');
      setInternalStage(editingNode.brainRegion || 'hippocampus');
      setCodeSnippet(editingNode.codeSnippet || '');
      setAiFeedback('');
      setAiError('');
      const hasExtra = Boolean(
        (editingNode.content && editingNode.content !== editingNode.summary) ||
        editingNode.codeSnippet
      );
      setShowDetails(hasExtra);
    } else {
      setTitle('');
      setSummary('');
      setSubject(subjects[0] || 'Learning & Mind');
      setSelectedTags([]);
      setCueIcon('lightbulb');
      setCueColor('#3B82F6');
      setContent('');
      setInternalCategory('general');
      setInternalStage('hippocampus');
      setCodeSnippet('');
      setAiFeedback('');
      setAiError('');
      setShowDetails(false);
    }
    setSubjectFilterQuery('');
    setTagFilterQuery('');
  }, [isOpen, editingNode, subjects]);

  const activeTokenMatch = useMemo(() => {
    const raw = activeField === 'title' ? title : activeField === 'summary' ? summary : '';
    const match = raw.match(/(?:^|\s)([@#])([a-zA-Z0-9_\- ]*)$/);
    if (!match) return null;
    return {
      trigger: match[1] as '@' | '#',
      query: match[2].toLowerCase()
    };
  }, [activeField, title, summary]);

  const inlineSuggestions = useMemo(() => {
    if (!activeTokenMatch) return [];
    if (activeTokenMatch.trigger === '@') {
      return subjects.filter((s) => s.toLowerCase().includes(activeTokenMatch.query)).slice(0, 6);
    }
    return approvedTags
      .filter((t) => t.toLowerCase().includes(activeTokenMatch.query) && !selectedTags.includes(t))
      .slice(0, 8);
  }, [activeTokenMatch, subjects, approvedTags, selectedTags]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [activeTokenMatch?.trigger, activeTokenMatch?.query]);

  const stripTrailingTrigger = (text: string) =>
    text.replace(/(?:^|\s)[@#][a-zA-Z0-9_\- ]*$/, (m) => (m.startsWith(' ') ? ' ' : ''));

  const handleApplySuggestion = (val: string) => {
    if (!activeTokenMatch) return;
    if (activeField === 'title') {
      setTitle((prev) => stripTrailingTrigger(prev).trimEnd());
      titleInputRef.current?.focus();
    }
    if (activeField === 'summary') {
      setSummary((prev) => stripTrailingTrigger(prev).trimEnd());
      summaryInputRef.current?.focus();
    }

    if (activeTokenMatch.trigger === '@') {
      setSubject(val);
    } else {
      setSelectedTags((prev) => (prev.includes(val) ? prev : [...prev, val].slice(0, 10)));
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeTokenMatch || inlineSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % inlineSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => (i - 1 + inlineSuggestions.length) % inlineSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const chosen = inlineSuggestions[highlightIdx] || inlineSuggestions[0];
      if (chosen) handleApplySuggestion(chosen);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveField(null);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 10)
    );
  };

  const handleAiOrganize = async () => {
    if (!title.trim() && !content.trim() && !summary.trim()) return;
    setIsOrganizing(true);
    setAiFeedback('');
    setAiError('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;

      const response = await fetch('/api/gemini/neuro-categorize', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, content: content || summary })
      });

      const data = await response.json();
      if (!response.ok) {
        setAiError(data?.error || 'Could not polish note right now. Try again.');
        return;
      }

      if (data.category) setInternalCategory(data.category);
      if (data.summary && !summary.trim()) setSummary(data.summary);
      if (data.tags && Array.isArray(data.tags)) {
        const matchedApproved = data.tags.filter((t: string) =>
          approvedTags.includes(t.toLowerCase())
        );
        if (matchedApproved.length > 0) {
          setSelectedTags((prev) =>
            Array.from(new Set([...prev, ...matchedApproved])).slice(0, 10)
          );
        }
      }
      if (data.suggestedCodeSnippet && !codeSnippet.trim()) {
        setCodeSnippet(data.suggestedCodeSnippet);
      }

      setAiFeedback(
        data.mode === 'offline-fallback'
          ? 'Polished takeaway & suggested matching tags (smart offline helper).'
          : 'Polished takeaway & attached matching tags from your approved list.'
      );
    } catch (err) {
      console.error('AI organize failed:', err);
      setAiError('Network error — please try again.');
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanTitle = title.replace(/(^|\s)[@#][a-zA-Z0-9_-]+/g, '').trim() || title.trim();
    const cleanSummary = summary.replace(/(^|\s)[@#][a-zA-Z0-9_-]+/g, '').trim();
    const nowIso = new Date().toISOString();

    if (isEditing && editingNode && onUpdateNode) {
      onUpdateNode({
        ...editingNode,
        title: cleanTitle,
        summary: cleanSummary || content.trim().slice(0, 140) || cleanTitle,
        content: content.trim() || cleanSummary || cleanTitle,
        category: internalCategory,
        subject,
        brainRegion: internalStage,
        cueIcon,
        cueColor,
        tags: selectedTags,
        codeSnippet: codeSnippet.trim() || undefined,
        updatedAt: nowIso
      });
      onClose();
      return;
    }

    // New notes always start in Fresh Notes ('hippocampus') and advance via real recall
    onSaveNode({
      title: cleanTitle,
      summary: cleanSummary || content.trim().slice(0, 140) || cleanTitle,
      content: content.trim() || cleanSummary || cleanTitle,
      category: internalCategory,
      subject,
      brainRegion: 'hippocampus',
      cueIcon,
      cueColor,
      srsData: {
        stability: 3,
        difficulty: 5,
        reps: 1,
        intervalDays: 1,
        lastReviewedAt: nowIso,
        nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
        retentionScore: 80
      },
      x: 380 + (Math.random() - 0.5) * 220,
      y: 260 + (Math.random() - 0.5) * 180,
      status: 'encoding',
      tags: selectedTags,
      codeSnippet: codeSnippet.trim() || undefined
    });

    onClose();
  };

  const filteredPopoverSubjects = subjects.filter((s) =>
    s.toLowerCase().includes(subjectFilterQuery.trim().toLowerCase())
  );
  const filteredPopoverTags = approvedTags.filter((t) =>
    t.toLowerCase().includes(tagFilterQuery.trim().toLowerCase())
  );

  // Stale Capture Gate lock dialog
  if (isCaptureLocked && !isEditing) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-[#222634] flex-row items-center gap-3 space-y-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display font-bold text-base text-slate-900 dark:text-white">
                Practice Before Capturing More
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {staleNodes.length} of {staleLimit} fading notes need a quick recall pass
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Adding notes without revisiting turns your journal into clutter. Clear at least{' '}
              <strong>1 fading note</strong> below to unlock Quick Capture immediately.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {staleNodes.slice(0, 5).map((node) => (
                <div
                  key={node.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {node.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      @{getCueSubject(node)} · {node.srsData?.retentionScore || 70}% recall strength
                    </p>
                  </div>
                  {onPracticeNode && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onPracticeNode(node);
                      }}
                      className="rounded-lg font-semibold shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Practice</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-[#222634] flex flex-wrap items-center justify-between gap-2">
              {onDisableStaleGate && (
                <button
                  type="button"
                  onClick={onDisableStaleGate}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Turn off capture gate
                </button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="ml-auto rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-0 overflow-hidden rounded-2xl max-h-[92vh] flex flex-col gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-200 dark:border-[#222634] flex-row items-center gap-3 space-y-0 pr-12">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${cueColor}20` }}
          >
            <CueIcon icon={cueIcon} className="w-4 h-4" color={cueColor} />
          </div>
          <div className="min-w-0">
            <DialogTitle className="font-display font-bold text-base text-slate-900 dark:text-white">
              {isEditing ? 'Edit Learning Note' : 'Quick Capture'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Type <code className="font-mono font-semibold">@</code> for a Subject or{' '}
              <code className="font-mono font-semibold">#</code> for an approved Tag
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {/* Compact Inline Popover Chips (Zero bulky tag/subject boxes) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* @Subject Popover Picker */}
            <Popover open={subjectPopoverOpen} onOpenChange={setSubjectPopoverOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors cursor-pointer"
                  />
                }
              >
                <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                <span>@{subject}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 p-2 bg-white dark:bg-[#161A26] border border-slate-200 dark:border-[#262C3D] rounded-xl shadow-xl"
              >
                <div className="space-y-2">
                  <Input
                    value={subjectFilterQuery}
                    onChange={(e) => setSubjectFilterQuery(e.target.value)}
                    placeholder="Filter subjects..."
                    className="h-7 text-xs bg-slate-50 dark:bg-[#0B0D12]"
                  />
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {filteredPopoverSubjects.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSubject(sub);
                          setSubjectPopoverOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                          subject === sub
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F2537]'
                        }`}
                      >
                        <span className="truncate">@{sub}</span>
                        {subject === sub && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 dark:border-[#222634]">
                    <button
                      type="button"
                      onClick={() => {
                        setSubjectPopoverOpen(false);
                        onOpenTaxonomyManager();
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Manage @Subjects &amp; #Tags</span>
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Selected Tag Chips */}
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#1B2030] border border-slate-200 dark:border-[#262C3D] text-slate-700 dark:text-slate-300 font-mono text-[11px]"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                  aria-label={`Remove #${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* #Tag Popover Trigger */}
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-[#2C3347] hover:border-blue-500 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium transition-colors cursor-pointer"
                  />
                }
              >
                <Hash className="w-3 h-3 text-emerald-500" />
                <span>Add tag</span>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 p-2 bg-white dark:bg-[#161A26] border border-slate-200 dark:border-[#262C3D] rounded-xl shadow-xl"
              >
                <div className="space-y-2">
                  <Input
                    value={tagFilterQuery}
                    onChange={(e) => setTagFilterQuery(e.target.value)}
                    placeholder="Filter curated tags..."
                    className="h-7 text-xs bg-slate-50 dark:bg-[#0B0D12]"
                  />
                  <div className="max-h-44 overflow-y-auto flex flex-wrap gap-1.5 p-0.5">
                    {filteredPopoverTags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-slate-100 dark:bg-[#0B0D12] border border-slate-200 dark:border-[#222634] text-slate-700 dark:text-slate-300 hover:border-blue-400'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                    {filteredPopoverTags.length === 0 && (
                      <p className="text-[11px] text-slate-400 px-1 py-2">No matching tags</p>
                    )}
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 dark:border-[#222634] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTagPopoverOpen(false);
                        onOpenTaxonomyManager();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>Manage Tags</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTagPopoverOpen(false)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Field 1: What did you learn? */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              What did you learn? *
            </label>
            <Input
              ref={titleInputRef}
              type="text"
              required
              autoFocus
              placeholder="e.g. Why spacing beats cramming @Learning & Mind #memory"
              value={title}
              onFocus={() => setActiveField('title')}
              onKeyDown={handleInlineKeyDown}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-sm"
            />

            {/* Notion-style Floating @/# Popover under Title */}
            {activeField === 'title' && activeTokenMatch && (
              <InlineTokenMenu
                trigger={activeTokenMatch.trigger}
                suggestions={inlineSuggestions}
                highlightIdx={highlightIdx}
                onSelect={handleApplySuggestion}
                onOpenManager={() => {
                  setActiveField(null);
                  onOpenTaxonomyManager();
                }}
              />
            )}
          </div>

          {/* Field 2: One-line Memory Cue + Direct AI Polish */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Key takeaway (what sparks recall?)
              </label>
              <button
                type="button"
                onClick={handleAiOrganize}
                disabled={isOrganizing || (!title.trim() && !content.trim() && !summary.trim())}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium disabled:opacity-45 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                title="Draft key takeaway and suggest matching #tags from your title"
              >
                <Sparkles className={`w-3 h-3 ${isOrganizing ? 'animate-spin' : ''}`} />
                <span>{isOrganizing ? 'Polishing...' : 'AI Polish'}</span>
              </button>
            </div>
            <Input
              ref={summaryInputRef}
              type="text"
              placeholder="e.g. Retrieving an idea right before it fades doubles retention"
              value={summary}
              onFocus={() => setActiveField('summary')}
              onKeyDown={handleInlineKeyDown}
              onChange={(e) => setSummary(e.target.value)}
              className="h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-sm"
            />

            {aiFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{aiFeedback}</span>
              </div>
            )}

            {aiError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {/* Notion-style Floating @/# Popover under Summary */}
            {activeField === 'summary' && activeTokenMatch && (
              <InlineTokenMenu
                trigger={activeTokenMatch.trigger}
                suggestions={inlineSuggestions}
                highlightIdx={highlightIdx}
                onSelect={handleApplySuggestion}
                onOpenManager={() => {
                  setActiveField(null);
                  onOpenTaxonomyManager();
                }}
              />
            )}
          </div>

          {/* Visual Cue Icon + Accent Color */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1">
              {CUE_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCueIcon(opt.key)}
                  title={opt.label}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    cueIcon === opt.key
                      ? 'bg-slate-100 dark:bg-[#1D2230] border-blue-500 text-slate-900 dark:text-white'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#1A1E2B] text-slate-500'
                  }`}
                >
                  <CueIcon
                    icon={opt.key}
                    className="w-4 h-4"
                    color={cueIcon === opt.key ? cueColor : undefined}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {CUE_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => setCueColor(swatch.hex)}
                  title={swatch.label}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                    cueColor === swatch.hex
                      ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#13161F] scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                />
              ))}
            </div>
          </div>

          {/* Expandable Optional Context (Universal — No Stage/Type Selectors) */}
          <div className="border-t border-slate-200 dark:border-[#222634] pt-3">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-1 cursor-pointer"
            >
              <span>Add deeper notes or example quote (optional)</span>
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Extra context for scenarios &amp; recall
                </label>

                <Textarea
                  rows={3}
                  placeholder="Why does this matter, or how would you apply it in everyday life?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs leading-relaxed"
                />

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Example, quote, or reference (optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder='e.g. "Say it back in your own words before replying."'
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0B0D12] border-slate-200 dark:border-[#222634] text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-200 dark:border-[#222634] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl px-5 text-xs font-semibold">
              {isEditing ? 'Update Note' : 'Save Note'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface InlineTokenMenuProps {
  trigger: '@' | '#';
  suggestions: string[];
  highlightIdx: number;
  onSelect: (val: string) => void;
  onOpenManager: () => void;
}

const InlineTokenMenu: React.FC<InlineTokenMenuProps> = ({
  trigger,
  suggestions,
  highlightIdx,
  onSelect,
  onOpenManager
}) => {
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl bg-white dark:bg-[#161A26] border border-slate-200 dark:border-[#2A3044] shadow-xl p-1.5 space-y-1 text-xs"
    >
      <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>{trigger === '@' ? 'Assign Subject (@)' : 'Attach Approved Tag (#)'}</span>
        <button
          type="button"
          onClick={onOpenManager}
          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Manage list
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {suggestions.map((item, idx) => (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                idx === highlightIdx
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1F2537]'
              }`}
            >
              <span>
                {trigger}
                {item}
              </span>
              <span className="text-[10px] text-slate-400">Select</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
          No matching {trigger === '@' ? 'subject' : 'tag'} found. Add approved items via{' '}
          <strong>Manage list</strong>.
        </p>
      )}
    </div>
  );
};
