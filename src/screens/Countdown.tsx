import { useEffect, useState } from 'preact/hooks';
import { formatCountdown } from '../lib/day.ts';

export function Countdown({ ms }: { ms: number }) {
  const [t, setT] = useState(ms);
  useEffect(() => {
    setT(ms);
    const id = window.setInterval(() => setT((x) => Math.max(0, x - 1000)), 1000);
    return () => window.clearInterval(id);
  }, [ms]);
  return <span class="mono">{formatCountdown(t)}</span>;
}
