import { useEffect, useState } from 'preact/hooks';
import { formatCountdown } from '../lib/day.ts';
import { siteDomain, shareText, shareLevelText, starString } from '../lib/share.ts';
import { useShare } from '../components/bits.tsx';

export function DailyResult(p: {
  won: boolean;
  guessCount: number;
  asset: string;
  title: string;
  dates: string;
  story: string;
  tvUrl: string;
  day: number;
  tiles: ('right' | 'near' | 'wrong')[];
}) {
  const { share, toast } = useShare();
  const text = shareText(p.day, p.tiles, p.won, siteDomain());
  return (
    <section class="card reveal" aria-label={p.won ? 'You won' : 'Game over'} aria-live="polite">
      <h2>{p.won ? `Solved in ${p.guessCount}.` : `It was ${p.asset}.`}</h2>
      <p class="reveal-title">{p.title}</p>
      <p class="dates">{p.dates}</p>
      <p class="story">{p.story}</p>
      <pre class="share-grid mono" aria-label="Share grid">{text.split('\n').slice(0, 2).join('\n')}</pre>
      <button class="btn btn-primary" type="button" onClick={() => void share(text)}>
        Share
      </button>
      <a class="btn btn-secondary" href={p.tvUrl} target="_blank" rel="noopener">
        Open on TradingView ↗
      </a>
      <p class="countdown">
        Next chart in <NextIn />
      </p>
      {toast}
    </section>
  );
}

function NextIn() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  return <span class="mono">{formatCountdown(next - now)}</span>;
}

export function LevelResult(p: {
  won: boolean;
  stars: number;
  asset: string;
  fact: string;
  world: number;
  n: number;
  hasNext: boolean;
  nextLocked: boolean;
  onNext: () => void;
  onRetry: () => void;
}) {
  const { share, toast } = useShare();
  const text = shareLevelText(p.world, p.n, p.stars, siteDomain());
  return (
    <section class="card reveal level-result" aria-label={p.won ? 'Level complete' : 'Level failed'} aria-live="polite">
      {p.won ? (
        <div class="stars" aria-label={`${p.stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} class={`star${i < p.stars ? ' lit' : ''}`} style={{ animationDelay: `${0.15 + i * 0.25}s` }} aria-hidden="true">
              ★
            </span>
          ))}
        </div>
      ) : (
        <h2>Out of guesses.</h2>
      )}
      <p class="reveal-title">
        {p.asset} <span class="mono dim">{starString(p.stars)}</span>
      </p>
      <p class="story">{p.fact}</p>
      {p.won && (
        <button class="btn btn-primary" type="button" onClick={() => void share(text)}>
          Share
        </button>
      )}
      <div class="result-row">
        <button class="btn btn-secondary" type="button" onClick={p.onRetry}>
          Retry for {p.stars >= 3 ? 'fun' : 'more ★'}
        </button>
        {p.hasNext && (
          <button
            class="btn btn-primary"
            type="button"
            disabled={p.nextLocked}
            title={p.nextLocked ? 'Earn more stars to unlock' : undefined}
            onClick={p.onNext}
          >
            Next level ›
          </button>
        )}
      </div>
      {p.nextLocked && <p class="dim">Next world needs 30 ★ from this one. Replay levels for 3 ★.</p>}
      {toast}
    </section>
  );
}
