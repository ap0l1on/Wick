import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Chart } from './components/Chart.tsx';
import { GuessBox } from './components/GuessBox.tsx';
import { GuessList } from './components/GuessList.tsx';
import { Hints } from './components/Hints.tsx';
import { Reveal } from './components/Reveal.tsx';
import { HowTo, StatsModal } from './components/Modals.tsx';
import { dayState, msToNextDay } from './lib/day.ts';
import { buildLookup, isCorrectAsset, matchGuess, type GuessEntry } from './lib/guess.ts';
import { store } from './lib/storage.ts';
import { shareText, siteDomain } from './lib/share.ts';
import { track, streakBucket } from './lib/analytics.ts';
import { decodeAnswer, findPuzzle, loadPuzzles, type Puzzle } from './lib/puzzles.ts';
import guessListData from '../data/guess-list.json';

const GUESS_LIST = guessListData as GuessEntry[];
const CLASS_LABEL: Record<string, string> = {
  crypto: 'Cryptocurrency',
  stock: 'Stock',
  index: 'Stock market index',
  commodity: 'Commodity',
  currency: 'Currency pair',
  etf: 'Fund (ETF)',
  fund: 'Fund (ETF)',
};
const classLabel = (c: string): string => CLASS_LABEL[c] ?? c;

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = store.getTheme();
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.setTheme(theme);
  }, [theme]);

  const [now, setNow] = useState(() => Date.now());
  const ds = useMemo(() => dayState(now), [now]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    loadPuzzles()
      .then((d) => setPuzzles(d.puzzles))
      .catch(() => setLoadError('Could not load today’s chart. Check your connection and reload.'));
  }, []);

  const lookup = useMemo(() => buildLookup(GUESS_LIST), []);
  const puzzle = ds.kind === 'live' && puzzles ? findPuzzle(puzzles, ds.day) : null;

  const [game, setGame] = useState(() => (ds.kind === 'live' ? store.loadGame(ds.day) : null));
  useEffect(() => {
    setGame(ds.kind === 'live' ? store.loadGame(ds.day) : null);
  }, [ds.day, ds.kind, puzzles !== null]);

  const [stats, setStats] = useState(() => store.loadStats());
  const [showHow, setShowHow] = useState(() => !store.seenHowto());
  const [showStats, setShowStats] = useState(false);
  const [firstGuessDone, setFirstGuessDone] = useState(false);

  useEffect(() => {
    if (showHow) track('howto_opened', { first_visit: store.seenHowto() ? 0 : 1 });
  }, []);

  const finished = game?.finished ?? false;
  const guesses = game?.guesses ?? [];

  // Decode answer ONLY in memory; never render pre-finish (no spoilers in DOM/title/URL).
  const answer = useMemo(() => {
    if (!puzzle) return null;
    try {
      return decodeAnswer(puzzle);
    } catch {
      return null;
    }
  }, [puzzle]);
  const answerAsset = finished ? answer?.asset : undefined;

  // Hint visibility: hint 1 from start, each wrong guess unlocks next (max 5).
  const wrongCount = guesses.filter((g) => g.tile !== 'right').length;
  const visibleHints = finished ? 5 : Math.min(5, 1 + wrongCount);

  useEffect(() => {
    document.title = ds.kind === 'live' ? `Wick #${ds.day} — Name the chart` : 'Wick — Name the chart';
  }, [ds.day, ds.kind]);

  const persist = (day: number, g: NonNullable<typeof game>): void => {
    setGame(g);
    store.saveGame(day, g);
  };

  const finishGame = useCallback(
    (day: number, g: NonNullable<typeof game>, won: boolean): void => {
      const done: typeof g = { ...g, finished: true, won };
      persist(day, done);
      setStats((prev) => {
        // guard double-count: if game was already finished, don't re-apply
        if (game?.finished) return prev;
        const next = store.applyResult(prev, day, won, done.guesses.length);
        store.saveStats(next);
        return next;
      });
      const p = puzzles ? findPuzzle(puzzles, day) : null;
      track('game_finished', { day, result: won ? 'win' : 'loss', guesses: won ? done.guesses.length : 'X' });
      void p;
    },
    [game?.finished, puzzles],
  );

  const submitGuess = (raw: string): string | null => {
    if (!puzzle || !answer || ds.kind !== 'live') return 'Game not ready. Reload.';
    if (finished) return 'Game over.';
    const entry = matchGuess(raw, lookup);
    if (!entry) return 'Pick one from the list';
    const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (guesses.some((g) => norm(g.name) === norm(entry.name))) return 'Already guessed';
    const correct = isCorrectAsset(entry, answer.asset, answer.aliases ?? []);
    // Answer class: canonical class from guess list by asset, fallback from hints[0].
    const answerClass = guessClassOf(answer.asset) ?? classOfHint(puzzle.hints[0]);
    const t = correct ? 'right' : entry.class === answerClass ? 'near' : 'wrong';
    const row = { name: entry.name, class: classLabel(entry.class), tile: t as 'right' | 'near' | 'wrong' };
    const next = { guesses: [...guesses, row], finished: false, won: false };
    if (!firstGuessDone) {
      setFirstGuessDone(true);
      track('game_started', { day: ds.day, difficulty: puzzle.difficulty });
      const s = store.loadStats();
      if (s.streak >= 2) track('returning_player', { streak_bucket: streakBucket(s.streak) });
    }
    if (t !== 'right') {
      const n = Math.min(5, 1 + wrongCount + 1);
      if (n >= 2 && n <= 5) {
        // hint n becomes visible (was locked)
        window.setTimeout(() => track('hint_seen', { n }), 0);
      }
    }
    if (correct) {
      persist(ds.day, { ...next, finished: true, won: true });
      setStats((prev) => {
        if (game?.finished) return prev;
        const nx = store.applyResult(prev, ds.day, true, next.guesses.length);
        store.saveStats(nx);
        return nx;
      });
      track('game_finished', { day: ds.day, result: 'win', guesses: next.guesses.length });
      return null;
    }
    if (next.guesses.length >= 5) {
      finishGame(ds.day, next, false);
      return null;
    }
    persist(ds.day, next);
    return null;
  };

  const doShare = async (): Promise<void> => {
    if (!finished) return;
    const domain = siteDomain();
    const text = shareText(ds.day, guesses.map((g) => g.tile), game?.won ?? false, domain);
    let method = 'clipboard';
    try {
      if (navigator.share) {
        await navigator.share({ text });
        method = 'web_share';
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* clipboard blocked */
      }
    }
    track('share_clicked', { method });
  };

  const openHow = (): void => {
    setShowStats(false);
    setShowHow(true);
    track('howto_opened', { first_visit: 0 });
  };
  const openStats = (): void => {
    setShowHow(false);
    setShowStats(true);
    track('stats_opened', {});
  };

  return (
    <div>
      <header class="site-header">
        <div class="header-inner">
          <a class="wordmark" href="./" aria-label="Wick home">
            <svg class="wordmark-candle" width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
              <line x1="9" y1="1" x2="9" y2="21" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" />
              <rect x="3.5" y="7" width="11" height="9" rx="2.5" fill="var(--accent)" />
            </svg>
            Wick
          </a>
          <div class="icon-row">
            <button class="icon-btn" type="button" aria-label="Statistics" onClick={openStats}>▦</button>
            <button class="icon-btn" type="button" aria-label="How to play" onClick={openHow}>?</button>
            <button
              class="icon-btn"
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>
          </div>
        </div>
      </header>

      <main class="wrap">
        {ds.kind === 'pre' && (
          <section class="card" aria-label="Countdown to launch">
            <h1>Wick #1 drops in <CountdownTo ts={Date.UTC(2026, 9, 14)} /></h1>
            <p>A daily game of famous market moments. 5 guesses. New chart at 00:00 UTC.</p>
            <button class="btn btn-primary" type="button" onClick={openHow}>How to play</button>
          </section>
        )}
        {ds.kind === 'post' && (
          <section class="card"><h1>New charts coming soon</h1><p>Season 1 (100 charts) is complete. Thanks for playing.</p></section>
        )}
        {ds.kind === 'live' && (
          <>
            <div class="title-row">
              <h1>Wick #{ds.day}</h1>
              <span class="dots" aria-label={`Difficulty ${puzzle?.difficulty ?? ''} of 3`}>
                {puzzle ? '●'.repeat(puzzle.difficulty) + '○'.repeat(3 - puzzle.difficulty) : ''}
              </span>
            </div>
            {loadError && <p role="alert">{loadError}</p>}
            {puzzle && (
              <>
                <section class="card chart-card" aria-label="Price chart">
                  <Chart
                    dates={puzzle.chart.d}
                    values={puzzle.chart.v}
                    revealed={finished}
                    title={finished ? answer?.title : undefined}
                    dateWindow={finished ? windowLabel(puzzle.chart.d) : undefined}
                  />
                </section>
                <Hints hints={puzzle.hints} visible={visibleHints} />
                {!finished && <GuessBox list={GUESS_LIST} disabled={!puzzle} onSubmit={submitGuess} />}
                <GuessList guesses={guesses} />
                {finished && answer && (
                  <Reveal
                    won={game?.won ?? false}
                    guessCount={guesses.length}
                    asset={answerAsset ?? answer.asset}
                    title={answer.title}
                    dates={windowLabel(puzzle.chart.d)}
                    story={answer.story}
                    tvUrl={answer.tvUrl}
                    day={ds.day}
                    onShare={doShare}
                    onTradingView={() => track('tradingview_clicked', { day: ds.day })}
                    msToNext={msToNextDay(Date.now())}
                  />
                )}
              </>
            )}
          </>
        )}
        <footer class="site-footer">
          <p>A game about market history. Not investment advice. · Charts built from public market data. · <a href="https://github.com/" rel="noopener">GitHub</a></p>
        </footer>
      </main>

      {showHow && (
        <HowTo
          onClose={() => {
            setShowHow(false);
            store.markHowto();
          }}
        />
      )}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}
    </div>
  );
}

function CountdownTo({ ts }: { ts: number }) {
  const [t, setT] = useState(() => Math.max(0, ts - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setT(Math.max(0, ts - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [ts]);
  const s = Math.floor(t / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return <span>{h}:{m}:{sec}</span>;
}

function windowLabel(d: string[]): string {
  if (!d.length) return '';
  const fmt = (iso: string): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, dd] = iso.split('-').map(Number);
    return `${months[(m ?? 1) - 1]} ${dd}, ${y}`;
  };
  return `${fmt(d[0])} – ${fmt(d[d.length - 1])}`;
}

function guessClassOf(asset: string): string | null {
  const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const hit = (GUESS_LIST as GuessEntry[]).find((e) => norm(e.name) === norm(asset));
  return hit ? hit.class : null;
}

function classOfHint(hint0: string): string {
  const rev: Record<string, string> = {
    Cryptocurrency: 'crypto',
    Stock: 'stock',
    'Stock market index': 'index',
    Commodity: 'commodity',
    'Currency pair': 'currency',
    'Fund (ETF)': 'etf',
  };
  return rev[hint0] ?? hint0;
}

export default App;
