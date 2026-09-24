import { useEffect, useState } from 'preact/hooks';
import { formatCountdown } from '../lib/day.ts';

interface Props {
  won: boolean;
  guessCount: number;
  asset: string;
  title: string;
  dates: string;
  story: string;
  tvUrl: string;
  day: number;
  onShare: () => void;
  onTradingView: () => void;
  msToNext: number;
}

export function Reveal(p: Props) {
  return (
    <section class="card reveal" aria-label={p.won ? 'You won' : 'Game over'}>
      <h2>{p.won ? `You got it in ${p.guessCount}.` : `It was ${p.asset}.`}</h2>
      <p style={{ margin: '4px 0', fontWeight: 700 }}>{p.title}</p>
      <p class="dates">{p.dates}</p>
      <p class="story">{p.story}</p>
      <button class="btn btn-primary" type="button" onClick={p.onShare}>Share</button>
      <a class="btn btn-secondary" href={p.tvUrl} target="_blank" rel="noopener" onClick={p.onTradingView}>
        Open on TradingView ↗
      </a>
      <p class="countdown">Next chart in <Countdown /></p>
    </section>
  );
}

export function Countdown() {
  const [text, setText] = useState('--:--:--');
  useEffect(() => {
    const tick = (): void => {
      const d = new Date();
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
      setText(formatCountdown(next - Date.now()));
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span>{text}</span>;
}
