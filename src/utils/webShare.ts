export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareNoteText(payload: {
  title: string;
  text: string;
}): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if share fails (e.g. desktop permissions / iframe)
    }
  }

  const fullText = `${payload.title}\n\n${payload.text}`;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fullText);
      return 'copied';
    }
  } catch {
    // Fall back to execCommand below
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copied) return 'copied';
    }
  } catch {
    // Ignore clipboard error
  }

  return 'failed';
}
