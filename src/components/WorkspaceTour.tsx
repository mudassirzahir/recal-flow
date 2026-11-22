import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, X, Plus, BookText, Zap, Sparkles } from 'lucide-react';
import { ViewMode } from '../types';

interface WorkspaceTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewMode) => void;
  onOpenQuickCapture: () => void;
}

const TOUR_STEPS: {
  title: string;
  body: string;
  actionLabel: string;
  targetView?: ViewMode;
  icon: React.ReactNode;
}[] = [
  {
    title: '1. Your Dashboard & 10-sec Capture',
    body: 'Start from your Dashboard for everything in one place—focus timer, due recall carousel, quick note bar, and @Subjects. Or hit Quick Capture anywhere using @ and # popovers.',
    actionLabel: 'Try Quick Capture',
    icon: <Plus className="w-4 h-4 text-blue-500" />
  },
  {
    title: '2. Practice, play Blitz, or use AI Coaches',
    body: 'Earn XP and keep your streak alive across Flashcards, Fill Blank, Scenarios, Teach-Back AI, our Quick Match Blitz game—or launch a ready-made study prompt in ChatGPT, Claude, or Gemini.',
    actionLabel: 'Open Practice',
    targetView: 'practice',
    icon: <Zap className="w-4 h-4 text-amber-500" />
  },
  {
    title: '3. Explore inside Notes Vault',
    body: 'All your learnings live in one Vault. Switch cleanly between Cards, calm Recap Slides, and your Connect Map (drag cards freely, click Details to inspect).',
    actionLabel: 'Open Notes Vault',
    targetView: 'notes',
    icon: <BookText className="w-4 h-4 text-emerald-500" />
  }
];

export const WorkspaceTour: React.FC<WorkspaceTourProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenQuickCapture
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[stepIndex];

  const handleAction = () => {
    if (stepIndex === 0) {
      onOpenQuickCapture();
    } else if (step.targetView) {
      onNavigate(step.targetView);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="fixed bottom-4 left-4 sm:left-20 z-40 w-[calc(100%-2rem)] max-w-sm bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl shadow-2xl p-4 space-y-3 text-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1B2030] flex items-center justify-center">
              {step.icon}
            </span>
            <div>
              <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Quick Walkthrough · {stepIndex + 1}/
                {TOUR_STEPS.length}
              </p>
              <h3 className="font-display font-bold text-sm">{step.title}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2030]"
            aria-label="Close walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between pt-1 gap-2">
          <button
            onClick={handleAction}
            className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold transition-colors"
          >
            {step.actionLabel}
          </button>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => i - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#222634] hover:bg-slate-50 dark:hover:bg-[#1B2030] text-slate-600 dark:text-slate-300"
                title="Previous step"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {stepIndex < TOUR_STEPS.length - 1 ? (
              <button
                onClick={() => setStepIndex((i) => i + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
