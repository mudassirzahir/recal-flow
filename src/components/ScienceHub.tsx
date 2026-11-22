import React from 'react';
import { Zap, Clock, Layers, ShieldCheck, KeyRound, Keyboard, Trophy } from 'lucide-react';
import docsVisual from '../assets/images/docs_visual_cues_1795276631001.jpg';

export const ScienceHub: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 text-slate-900 dark:text-slate-100">
      {/* Header Split */}
      <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-3">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Guide &amp; Learning Science · Journal your learning
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Remember what you learn through real recall and daily momentum
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            RecallFlow is built for any learner—whether you are reading books, picking up a new
            craft, studying history, or learning at work. Capture fast cues with{' '}
            <code className="font-mono text-xs">@Subjects</code> &amp;{' '}
            <code className="font-mono text-xs">#Tags</code>, practice actively through 5 engaging
            modes (or external AI coaches), and explore connections inside your{' '}
            <strong>Notes Vault</strong>.
          </p>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#222634] aspect-[4/3] bg-slate-100 dark:bg-[#0B0D12]">
            <img
              src={docsVisual}
              alt="Color-tabbed study cue cards on a clean desk"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* 3-Step Workflow */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold">Your Daily Loop</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">01. Capture</span>
            <h3 className="font-display font-semibold text-base">Quick Capture + Popovers</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Type <code className="font-mono">@</code> for a Subject or{' '}
              <code className="font-mono">#</code> for a curated Tag inside a Notion-style dropdown.
              New entries start as Fresh Notes automatically—no stage sorting needed.
            </p>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
              02. Practice
            </span>
            <h3 className="font-display font-semibold text-base">5 Modes + AI Coaches</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Clear due notes via <strong>Flashcards</strong>, <strong>Fill Blank</strong>,{' '}
              <strong>Scenarios</strong>, <strong>Teach-Back AI</strong> (10+ meaningful words), or{' '}
              <strong>Quick Match Blitz</strong>—plus 1-click ChatGPT, Claude, and Gemini prompts.
            </p>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              03. Remember
            </span>
            <h3 className="font-display font-semibold text-base">Notes Vault &amp; Streaks</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Explore everything you learned in <strong>Notes Vault</strong> using{' '}
              <strong>Cards</strong>, <strong>Recap Slides</strong>, or <strong>Connect Map</strong>
              , and watch your Streak, XP, and mastery climb in <strong>Progress</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Proven Learning Principles */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold">Why this works (proven learning science)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm">
              <Zap className="w-4 h-4" />
              <span>Generation Effect &amp; Active Recall</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Retrieving missing words in <strong>Fill Blank</strong> or matching ideas in{' '}
              <strong>Quick Match</strong> forces active memory effort instead of passive skimming.
            </p>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <Clock className="w-4 h-4" />
              <span>Automatic Stages &amp; Backlog Gate</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Memory strength evolves internally as you review and link ideas, while the Stale
              Capture Gate helps you clear overdue notes before collecting more.
            </p>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold text-sm">
              <Layers className="w-4 h-4" />
              <span>Subject Isolation prevents mix-ups</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Grouping notes by <code className="font-mono">@Subject</code> keeps history, cooking,
              psychology, and work skills organized cleanly without muddling contexts.
            </p>
          </div>

          <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <Trophy className="w-4 h-4" />
              <span>Streaks, XP &amp; Socratic AI Coaching</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Small daily habits win over weekend cramming. Earn XP across Practice modes or jump
              straight into a personalized quiz conversation inside ChatGPT, Claude, or Gemini.
            </p>
          </div>
        </div>
      </section>

      {/* Account Sync, AI Quota & Shortcuts */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Preview vs. Signed-In</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Try everything immediately in Guest Preview Mode. Sign in with Google or Email &amp;
            Password (via Firebase) to sync your notes, streaks, XP, and Connect Map to the cloud.
          </p>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <KeyRound className="w-4 h-4 text-blue-500" />
            <span>Built-in AI Limits &amp; External Coaches</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Built-in AI checks use a daily per-user quota (15/day guest, 30/day signed in) with
            offline fallback—or export prompts straight into your own ChatGPT, Claude, or Gemini
            tab.
          </p>
        </div>

        <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Keyboard className="w-4 h-4 text-violet-500" />
            <span>Handy Shortcuts</span>
          </div>
          <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 font-mono">
            <li>⌘K / Ctrl+K · Quick Search</li>
            <li>@ / # · Subject &amp; Tag Popover</li>
            <li>← / → · Next / Prev Card</li>
            <li>Scroll Wheel · Zoom 2D Map</li>
            <li>ESC · Close Modals</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
