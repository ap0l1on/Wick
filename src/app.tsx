import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Game, windowLabel, guessClassOf } from './screens/Game.tsx';
import { Home } from './screens/Home.tsx';
import { Map } from './screens/Map.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { DailyResult, LevelResult } from './screens/results.tsx';
import { HowTo, StatsModal } from './components/Modals.tsx';
import { Wordmark } from './components/Wordmark.tsx';
import { dayState } from './lib/day.ts';
import { store } from './lib/storage.ts';
import { track } from './lib/analytics.ts';
import { decodeAnswer, findPuzzle, loadPuzzles, type Puzzle } from './lib/puzzles.ts';
import {
  loadWorld, decodeLevelAnswer, WORLD_META, type LevelJson,
} from './lib/worlds.ts';
import {
  starsForSolve, nextLevel, isLevelUnlocked,
  type LevelDef,
} from './lib/levels.ts';
import { loadProgress, recordLevel } from './lib/progress.ts';
import { loadSettings, applySettings, type Settings } from './lib/settings.ts';
import { levelNumber } from './lib/share.ts';
import type { GuessEntry } from './lib/guess.ts';
import guessListData from '../data/guess-list.json';

const GUESS_LIST = guessListData as GuessEntry[];

const DEFS: LevelDef[] = WORLD_META.flatMap((w) =>
  Array.from({ length: 20 }, (_, i) => ({ id: `w${w.id}-${String(i + 1).padStart(2, '0')}`, world: w.id, n: i + 1 })),
);

type Route =
  | { name: 'home' }
  | { name: 'daily' }
  | { name: 'map' }
  | { name: 'level'; id: string }
  | { name: 'settings'; from: Route };

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

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  const [route, setRoute] = useState<Route>({ name: 'home' });
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

  const [game, setGame] = useState(() => (ds.kind === 'live' ? store.loadGame(ds.day) : null));
  useEffect(() => {
    setGame(ds.kind === 'live' ? store.loadGame(ds.day) : null);
  }, [ds.day, ds.kind, puzzles !== null]);

  const [stats, setStats] = useState(() => store.loadStats());
  const [showHow, setShowHow] = useState(() => !store.seenHowto());
  const [showStats, setShowStats] = useState(false);
  const [progressBump, setProgressBump] = useState(0);
  void progressBump;

  useEffect(() => {
    if (showHow) track('howto_opened', { first_visit: store.seenHowto() ? 0 : 1 });
  }, []);

  const puzzle = ds.kind === 'live' && puzzles ? findPuzzle(puzzles, ds.day) : null;
  const answer = useMemo(() => {
    if (!puzzle) return null;
    try {
      return decodeAnswer(puzzle);
    } catch {
      return null;
    }
  }, [puzzle]);

  useEffect(() => {
    const t =
      route.name === 'daily' && ds.kind === 'live'
        ? `Wick #${ds.day} — Name the chart`
        : route.name === 'level'
          ? `Wick · Level — Name the chart`
          : 'Wick — Name the chart';
    document.title = t;
  }, [route, ds.day, ds.kind]);

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
  const openSettings = (from: Route): void => setRoute({ name: 'settings', from });

  const finishDaily = useCallback(
    (day: number, won: boolean, guessCount: number): void => {
      setStats((prev) => {
        if (game?.finished) return prev;
        const next = store.applyResult(prev, day, won, guessCount);
        store.saveStats(next);
        return next;
      });
      track('game_finished', { day, result: won ? 'win' : 'loss', guesses: won ? guessCount : 'X' });
    },
    [game?.finished],
  );

  return (
    <div>
      <header class="site-header">
        <div class="header-inner">
          <button class="wordmark-btn" type="button" aria-label="Wick home" onClick={() => setRoute({ name: 'home' })}>
            <Wordmark height={26} />
          </button>
          <div class="icon-row">
            <button class="icon-btn" type="button" aria-label="Statistics" onClick={openStats}>▦</button>
            <button class="icon-btn" type="button" aria-label="How to play" onClick={openHow}>?</button>
            <button
              class="icon-btn"
              type="button"
              aria-label="Settings"
              onClick={() => openSettings(route.name === 'settings' ? { name: 'home' } : route)}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main class="wrap">
        {route.name === 'home' && (
          <Home
            defs={DEFS}
            onDaily={() => setRoute({ name: 'daily' })}
            onLevels={() => setRoute({ name: 'map' })}
            onStats={openStats}
            onHow={openHow}
          />
        )}

        {route.name === 'daily' && (
          <>
            {ds.kind === 'pre' && (
              <section class="card" aria-label="Not launched">
                <h1>Season over or not started</h1>
                <button class="btn btn-primary" type="button" onClick={() => setRoute({ name: 'map' })}>
                  Play Levels instead
                </button>
              </section>
            )}
            {ds.kind === 'post' && (
              <section class="card">
                <h1>Season complete</h1>
                <p>All 100 daily charts are done. The Levels map stays open.</p>
                <button class="btn btn-primary" type="button" onClick={() => setRoute({ name: 'map' })}>
                  Play Levels
                </button>
              </section>
            )}
            {ds.kind === 'live' && (
              <>
                {loadError && <p role="alert">{loadError}</p>}
                {puzzle && answer && (
                  <DailyGame
                    day={ds.day}
                    puzzle={puzzle}
                    asset={answer.asset}
                    aliases={answer.aliases ?? []}
                    title={answer.title}
                    story={answer.story}
                    tvUrl={answer.tvUrl}
                    game={game}
                    setGame={setGame}
                    stats={stats}
                    setStats={finishDaily}
                    settings={settings}
                    onOpenSettings={() => openSettings({ name: 'daily' })}
                  />
                )}
              </>
            )}
          </>
        )}

        {route.name === 'map' && (
          <Map defs={DEFS} worlds={WORLD_META} onPlay={(id) => setRoute({ name: 'level', id })} onHome={() => setRoute({ name: 'home' })} />
        )}

        {route.name === 'level' && (
          <LevelRoute
            id={route.id}
            defs={DEFS}
            settings={settings}
            onOpenSettings={() => openSettings({ name: 'level', id: route.id })}
            onExit={() => setRoute({ name: 'map' })}
            onPlay={(id) => setRoute({ name: 'level', id })}
            onProgress={() => setProgressBump((b) => b + 1)}
          />
        )}

        {route.name === 'settings' && (
          <SettingsScreen settings={settings} onChange={setSettings} onBack={() => setRoute(route.from)} />
        )}

        <footer class="site-footer">
          <p>
            Not investment advice. Charts built from public market data, refreshed by GitHub Actions. ·{' '}
            <a href="https://github.com/" rel="noopener">GitHub</a>
          </p>
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
      {showStats && <StatsModal stats={stats} defs={DEFS} onClose={() => setShowStats(false)} />}
    </div>
  );
}

// ---------------- Daily ----------------

function DailyGame(p: {
  day: number;
  puzzle: Puzzle;
  asset: string;
  aliases: string[];
  title: string;
  story: string;
  tvUrl: string;
  game: ReturnType<typeof store.loadGame>;
  setGame: (g: NonNullable<ReturnType<typeof store.loadGame>>) => void;
  stats: ReturnType<typeof store.loadStats>;
  setStats: (day: number, won: boolean, guessCount: number) => void;
  settings: Settings;
  onOpenSettings: () => void;
}) {
  const [result, setResult] = useState<{ won: boolean; guesses: number } | null>(
    p.game?.finished ? { won: p.game.won, guesses: p.game.guesses.length } : null,
  );
  const answerClass = guessClassOf(GUESS_LIST, p.asset) ?? classOfHint(p.puzzle.hints[0]);
  const guesses = p.game?.guesses ?? [];

  return (
    <Game
      key={p.day}
      modeLabel={`Daily #${p.day}`}
      title={`Wick #${p.day}`}
      difficulty={p.puzzle.difficulty}
      dates={p.puzzle.chart.d}
      values={p.puzzle.chart.v}
      candles={p.puzzle.chart.candles}
      answerAsset={p.asset}
      answerAliases={p.aliases}
      answerClass={answerClass}
      initial={p.game}
      onPersist={(g) => {
        p.setGame(g);
        store.saveGame(p.day, g);
      }}
      onFinish={(r) => {
        setResult({ won: r.won, guesses: r.guesses });
        if (!p.game?.finished) p.setStats(p.day, r.won, r.guesses);
      }}
      hintsMode="auto"
      hintTexts={p.puzzle.hints}
      freeHintAfter={0}
      settings={p.settings}
      onOpenSettings={p.onOpenSettings}
      revealTitle={p.title}
      revealDates={windowLabel(p.puzzle.chart.d)}
      result={
        result && (
          <DailyResult
            won={result.won}
            guessCount={result.guesses}
            asset={p.asset}
            title={p.title}
            dates={windowLabel(p.puzzle.chart.d)}
            story={p.story}
            tvUrl={p.tvUrl}
            day={p.day}
            tiles={guesses.map((x) => x.tile)}
          />
        )
      }
    />
  );
}

// ---------------- Level ----------------

function LevelRoute(p: {
  id: string;
  defs: LevelDef[];
  settings: Settings;
  onOpenSettings: () => void;
  onExit: () => void;
  onPlay: (id: string) => void;
  onProgress: () => void;
}) {
  const [levels, setLevels] = useState<LevelJson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [last, setLast] = useState<{ won: boolean; stars: number; guesses: number; hints: number } | null>(null);

  const m = /^w(\d+)-(\d+)$/.exec(p.id);
  const world = m ? Number(m[1]) : 0;
  useEffect(() => {
    let alive = true;
    setLevels(null);
    setLast(null);
    loadWorld(world)
      .then((l) => {
        if (alive) setLevels(l);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [world, p.id]);

  const prog = loadProgress();
  const def = p.defs.find((d) => d.id === p.id) ?? null;
  const unlocked = def ? isLevelUnlocked(def, prog.stars, p.defs) : false;
  const level = levels?.find((l) => l.id === p.id) ?? null;
  const answer = (() => {
    if (!level) return null;
    try {
      return decodeLevelAnswer(level);
    } catch {
      return null;
    }
  })();

  if (!def || !unlocked) {
    return (
      <section class="card" aria-label="Level locked">
        <h1>Locked</h1>
        <p>Earn 30 ★ in the previous world to open this level.</p>
        <button class="btn btn-primary" type="button" onClick={p.onExit}>
          Back to map
        </button>
      </section>
    );
  }
  if (loadError || (levels && !level)) {
    return (
      <section class="card" aria-label="Level failed to load">
        <h1>Could not load this level.</h1>
        <p>Check your connection and try again.</p>
        <button class="btn btn-primary" type="button" onClick={p.onExit}>
          Back to map
        </button>
      </section>
    );
  }
  if (!level || !answer) return <section class="card" aria-label="Loading level"><p>Loading level…</p></section>;

  const answerClass = guessClassOf(GUESS_LIST, answer.asset) ?? 'stock';
  const n = levelNumber(level.world, level.n);
  const next = def ? nextLevel(def, p.defs) : null;
  const nextProg = loadProgress();
  const nextLocked = next ? !isLevelUnlocked(next, nextProg.stars, p.defs) : true;

  return (
    <>
      <div class="map-head">
        <button class="link-btn" type="button" onClick={p.onExit}>
          ‹ Map
        </button>
      </div>
      <Game
        key={`${level.id}:${retryNonce}`}
        modeLabel={`W${level.world} · Level ${level.n}`}
        title={`Level ${n}`}
        difficulty={level.difficulty}
        dates={level.chart.d}
        values={level.chart.v}
        candles={level.chart.candles}
        answerAsset={answer.asset}
        answerAliases={[]}
        answerClass={answerClass}
        initial={null}
        onPersist={() => undefined}
        onFinish={(r) => {
          const stars = r.won ? starsForSolve(r.guesses, r.hintsUsed) : 0;
          if (r.won) {
            recordLevel(loadProgress(), level.id, stars, r.hintsUsed);
            p.onProgress();
          }
          setLast({ won: r.won, stars, guesses: r.guesses, hints: r.hintsUsed });
          track('game_finished', { day: n, result: r.won ? 'win' : 'loss', guesses: r.won ? r.guesses : 'X' });
        }}
        hintsMode="manual"
        hintTexts={level.hints}
        freeHintAfter={level.world <= 2 ? 2 : 0}
        settings={p.settings}
        onOpenSettings={p.onOpenSettings}
        revealTitle={answer.asset}
        revealDates={windowLabel(level.chart.d)}
        result={
          last && (
            <LevelResult
              won={last.won}
              stars={last.stars}
              asset={answer.asset}
              fact={answer.fact}
              world={level.world}
              n={level.n}
              hasNext={next !== null}
              nextLocked={nextLocked}
              onNext={() => {
                if (next) p.onPlay(next.id);
              }}
              onRetry={() => {
                setLast(null);
                setRetryNonce((x) => x + 1);
              }}
            />
          )
        }
      />
    </>
  );
}

export default App;
