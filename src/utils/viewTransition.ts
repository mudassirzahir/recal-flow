import { flushSync } from 'react-dom';

interface DocumentWithViewTransition {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
  };
}

export function runWithViewTransition(update: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    update();
    return;
  }

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const doc = document as Document & DocumentWithViewTransition;

  if (prefersReduced || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }

  try {
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        update();
      });
    });
    transition.ready?.catch(() => {});
    transition.finished?.catch(() => {});
  } catch {
    update();
  }
}
