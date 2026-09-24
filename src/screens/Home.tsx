import { Wordmark } from '../components/Wordmark.tsx';
import { dayState, msToNextDay } from '../lib/day.ts';
import { currentLevel, totalStars, TOTAL_STARS } from '../lib/levels.ts';
import type { LevelDef } from '../lib/levels.ts';
import { store } from '../lib/storage.ts';
import { loadProgress } from '../lib/progress.ts';
import { Countdown } from './Countdown.tsx';

export function Home(p: {
  defs: LevelDef[];
  onDaily: () => void;
  onLevels: () => void;
  onStats: () => void;
  onHow: () => void;
}) {
  const now = Date.now();
  const ds = dayState(now);
  const stats = store.loadStats();
  const prog = loadProgress();
  const stars = totalStars(prog.stars);
  const cur = currentLevel(prog.stars, p.defs);
  const todayGame = ds.kind === 'live' ? store.loadGame(ds.day) : null;
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <div class="home">
      <h1 class="sr-only">Wick — Name the chart</h1>
      <div class="home-mark">
        <Wordmark glow height={44} />
        <p class="tagline">Name the chart.</p>
      </div>
      <div class="mode-tiles">
        <button class="mode-tile daily-tile" type="button" onClick={p.onDaily}>
          <span class="tile-kicker mono">DAILY #{ds.kind === 'live' ? ds.day : '–'}</span>
          {todayGame?.finished ? (
            <span class="tile-main">Solved in {todayGame.guesses.length} ✓</span>
          ) : (
            <span class="tile-main">
              Next chart in <Countdown ms={msToNextDay(now)} />
            </span>
          )}
          <span class="tile-sub">Streak {stats.streak} · everyone plays the same chart</span>
        </button>
        <button class="mode-tile levels-tile" type="button" onClick={p.onLevels}>
          <span class="tile-kicker mono">
            LEVELS{cur ? ` · WORLD ${cur.world} · LEVEL ${cur.n}` : ' · COMPLETE'}
          </span>
          <span class="tile-main mono">{stars} ★ / {TOTAL_STARS}</span>
          <span class="progress-track" aria-hidden="true">
            <span class="progress-fill" style={{ width: `${Math.round((stars / TOTAL_STARS) * 100)}%` }} />
          </span>
          <span class="tile-sub">120 charts · 6 worlds · your pace</span>
        </button>
      </div>
      <div class="stats-row" aria-label="Statistics summary">
        <div>
          <div class="stat-num mono">{stats.played}</div>
          <div class="stat-label">Played</div>
        </div>
        <div>
          <div class="stat-num mono">{winPct}%</div>
          <div class="stat-label">Win</div>
        </div>
        <div>
          <div class="stat-num mono">{stats.streak}</div>
          <div class="stat-label">Streak</div>
        </div>
        <div>
          <div class="stat-num mono">{stats.maxStreak}</div>
          <div class="stat-label">Best</div>
        </div>
        <button class="link-btn" type="button" onClick={p.onStats}>
          Details
        </button>
        <button class="link-btn" type="button" onClick={p.onHow}>
          How to play
        </button>
      </div>
    </div>
  );
}
