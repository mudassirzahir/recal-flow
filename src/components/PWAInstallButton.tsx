import React, { useState } from 'react';
import { Download, Share, Plus, X, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'menu-item' }> = ({
  variant = 'compact'
}) => {
  const { isInstallable, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!isInstallable && !isIOS) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      {variant === 'menu-item' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1B1F2C] text-blue-600 dark:text-blue-400 font-medium transition-colors text-left cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install RecallFlow App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
          title="Install RecallFlow as an offline-ready app"
          aria-label="Install RecallFlow App"
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {showIOSGuide && (
        <div
          onClick={() => setShowIOSGuide(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#13161F] border border-slate-200 dark:border-[#222634] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base">Install RecallFlow on iOS</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Use RecallFlow full-screen and offline from your Home Screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span>
                  Tap the <Share className="w-3.5 h-3.5 inline text-blue-500 mx-0.5" />{' '}
                  <strong>Share</strong> button in Safari.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <span>
                  Choose <Plus className="w-3.5 h-3.5 inline text-blue-500 mx-0.5" />{' '}
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
            </ol>

            <Button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl text-xs font-semibold cursor-pointer"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 md:bottom-4 right-4 z-40 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-medium shadow-lg flex items-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>Offline — reading cached notes &amp; flashcards</span>
    </div>
  );
};
