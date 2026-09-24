import { useState } from 'preact/hooks';

// Five candle pips: filled amber while guesses remain, grey once used.
export function CandlePips({ used, total = 5 }: { used: number; total?: number }) {
  return (
    <span class="pips" role="img" aria-label={`${total - used} of ${total} guesses left`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} class={`pip${i < used ? ' spent' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div class="toast" role="status">
      {text}
    </div>
  );
}

/** Web Share API on mobile, clipboard elsewhere, with a toast. */
export function useShare() {
  const [toast, setToast] = useState<string | null>(null);
  const share = async (text: string): Promise<string> => {
    let method = 'clipboard';
    try {
      if (navigator.share) {
        await navigator.share({ text });
        method = 'web_share';
      } else {
        await navigator.clipboard.writeText(text);
        setToast('Copied');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setToast('Copied');
      } catch {
        /* clipboard blocked */
      }
    }
    window.setTimeout(() => setToast(null), 2200);
    return method;
  };
  return { share, toast: <Toast text={toast} /> };
}
