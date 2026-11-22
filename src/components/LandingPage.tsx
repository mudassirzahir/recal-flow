import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  LogIn,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Zap,
  AlertCircle,
  Compass,
  Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '../assets/images/hero_memory_studio_1795276631827.jpg';

interface LandingPageProps {
  onStartGuest: () => void;
  onOpenAuth: () => void;
  onOpenDocs: () => void;
  isSignedIn: boolean;
  userName?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartGuest,
  onOpenAuth,
  onOpenDocs,
  isSignedIn,
  userName
}) => {
  const [demoFlipped, setDemoFlipped] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
          RecallFlow
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <a
            href="#problem-solution"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Why RecallFlow
          </a>
          <a
            href="#three-steps"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            3 Easy Steps
          </a>
          <a
            href="#why-it-works"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Memory Science
          </a>
          <button
            onClick={onOpenDocs}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Guide &amp; Docs
          </button>
        </nav>

        <div className="shrink-0">
          <Button onClick={onStartGuest} size="lg" className="font-semibold">
            {isSignedIn ? 'Open Journal' : 'Start Journaling'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-8 pb-20 space-y-20">
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-xs font-medium tracking-wide text-blue-600 dark:text-blue-400">
              Journal your learning · Daily streaks · Active recall
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12] text-balance text-slate-900 dark:text-white">
              Journal what you learn so you actually remember it.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              From books, podcasts, and classes to everyday discoveries—drop a 10-second takeaway
              tagged with <code className="font-mono text-xs">@Subject</code>. RecallFlow turns your
              journal into spaced flashcards, quick matching games, and AI coach prompts.
            </p>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={onStartGuest}
                  size="lg"
                  className="h-11 px-5 rounded-xl text-sm font-semibold shadow-md shadow-blue-600/20"
                >
                  <span>
                    {isSignedIn
                      ? `Continue as ${userName || 'Learner'}`
                      : 'Try Live Preview (Guest)'}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>

              {!isSignedIn && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onOpenAuth}
                  className="h-11 px-5 rounded-xl text-sm font-medium"
                >
                  <LogIn className="w-4 h-4 mr-1" />
                  <span>Sign In to Save</span>
                </Button>
              )}

              <button
                onClick={onOpenDocs}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                <span>How it works</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Works for any topic—no tech background needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Cloud sync via Firebase when you sign in
              </span>
            </div>
          </motion.div>

          {/* Right Column: Studio Image + Interactive Universal Card */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:col-span-6 space-y-4"
          >
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#222634] shadow-lg bg-slate-100 dark:bg-[#13161F] aspect-[16/10]">
              <img
                src={heroImage}
                alt="Clean creative learning studio desk with visual study cue cards"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Interactive Micro-Practice Preview */}
            <div
              onClick={() => setDemoFlipped((f) => !f)}
              className="rounded-2xl bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] p-5 cursor-pointer hover:border-blue-500/60 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Interactive Card Preview · @Science &amp; Nature
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{demoFlipped ? 'Answer shown' : 'Click to test recall'}</span>
                </span>
              </div>

              {!demoFlipped ? (
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Why does patting food dry before searing build richer flavor?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Try recalling the takeaway in your own words, then click to flip.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <h3 className="font-display font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                    The Maillard Reaction
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    Dry heat above 140°C lets sugars and amino acids brown quickly—surface moisture
                    traps the pan at 100°C steam instead.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* Problem vs Solution Section */}
        <section id="problem-solution" className="space-y-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stop letting great insights vanish into forgotten notes
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Built for busy people who learn from articles, books, videos, and daily life—without
              spending an hour formatting folders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Problem</span>
              </div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Passive notes feel productive, then fade within days
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                You read an insight or hear a smart idea, highlight it or paste it into a note app,
                and feel satisfied. Two weeks later, you rarely reopen that page and have already
                forgotten why it mattered.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-blue-200 dark:border-blue-900/50 rounded-2xl p-6 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Solution</span>
              </div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                An active learning journal that pulls ideas back at the right moment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                RecallFlow captures the core cue in 10 seconds with{' '}
                <code className="font-mono text-xs">@Subject</code> isolation, tracks daily streaks,
                and resurfaces fading ideas through flashcards, Quick Match games, and your favorite
                AI coach.
              </p>
            </div>
          </div>
        </section>

        {/* 3 Easy Steps */}
        <section id="three-steps" className="space-y-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              How RecallFlow stays fast &amp; rewarding
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              3 Easy Steps: Capture → Practice → Remember
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                  01. Capture
                </span>
                <Compass className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Journal in 10 seconds with @ &amp; #
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Write a short title and 1-line takeaway. Type{' '}
                <code className="font-mono text-xs">@</code> or{' '}
                <code className="font-mono text-xs">#</code> for an instant Notion-style dropdown
                from your curated subjects and tags.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                  02. Practice
                </span>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Play Blitz, Flashcards, or AI Coach
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Keep your streak alive with Flashcards, Fill-in-the-Blank, Scenarios, Teach-Back AI,
                our Quick Match game, or open a ready-made quiz prompt in ChatGPT, Claude, or
                Gemini.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  03. Explore &amp; Remember
                </span>
                <Layers className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Browse Vault &amp; Connect Map
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Switch seamlessly between Cards, calm Recap Slides, and your Connect Map inside
                Notes Vault—memory mastery grows automatically as you retrieve ideas.
              </p>
            </div>
          </div>
        </section>

        {/* Proven Learning Habits */}
        <section id="why-it-works" className="space-y-8">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Backed by cognitive science, not hype
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Every mechanism is built around proven memory habits that respect your time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 space-y-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <h3 className="font-display font-semibold text-sm">Active Recall</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Pulling an answer from memory before flipping builds much stronger recall than
                passive re-reading.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 space-y-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h3 className="font-display font-semibold text-sm">Automatic Progression</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                No manual stage sorting. New entries start as Fresh Notes and earn Core Knowledge
                only through real practice.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 space-y-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              <h3 className="font-display font-semibold text-sm">Connected Context</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Explore how notes inside a subject link together on the Connect Map so ideas
                reinforce each other.
              </p>
            </div>

            <div className="bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 space-y-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h3 className="font-display font-semibold text-sm">Anti-Backlog Gate</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Keep your streak honest by refreshing overdue notes before stacking up fresh unread
                captures.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
