import { useEffect, useState } from 'preact/hooks';
import type { Stats } from '../lib/storage.ts';
import { totalStars, worldStars } from '../lib/levels.ts';
import type { LevelDef } from '../lib/levels.ts';
import { loadProgress } from '../lib/progress.ts';
import { WORLD_META } from '../lib/worlds.ts';

const STEPS = [
  {
    title: 'Guess the chart',
    body: 'Every chart is a real market moment with the labels stripped off. You get 5 guesses to name the asset — type a company, coin or index.',
  },
  {
    title: 'Read the clues',
    body: 'Each wrong guess earns chips: same sector, country and type (✓/✗), and whether the answer is bigger or smaller (▲/▼). Levels also offer 3 hints — each costs a star.',
  },
  {
    title: 'Two ways to play',
    body: 'Daily: one chart for everyone, fresh at 00:00 UTC, with streaks. Levels: 120 charts in 6 worlds at your own pace, 3 ★ for fast solves.',
  },
];

export function HowTo({ onClose, step = 0 }: { onClose: () => void; step?: number }) {
  const [i, setI] = useState(step);
  useEffect(() => {
    const fn = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  const s = STEPS[i];
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <p class="mono dim small">
          {i + 1} / {STEPS.length}
        </p>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div class="result-row">
          {i > 0 ? (
            <button class="btn btn-secondary" type="button" onClick={() => setI(i - 1)}>
              ‹ Back
            </button>
          ) : (
            <span />
          )}
          {i < STEPS.length - 1 ? (
            <button class="btn btn-primary" type="button" onClick={() => setI(i + 1)}>
              Next ›
            </button>
          ) : (
            <button class="btn btn-primary" type="button" onClick={onClose}>
              Play
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsModal({ stats, defs, onClose }: { stats: Stats; defs: LevelDef[]; onClose: () => void }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...stats.dist);
  const labels = ['1', '2', '3', '4', '5', 'X'];
  const prog = loadProgress();
  const stars = totalStars(prog.stars);
  useEffect(() => {
    const fn = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Statistics" onClick={(e) => e.stopPropagation()}>
        <h2>Daily stats</h2>
        <div class="stats-grid">
          <div><div class="stat-num mono">{stats.played}</div><div class="stat-label">Played</div></div>
          <div><div class="stat-num mono">{winPct}%</div><div class="stat-label">Win</div></div>
          <div><div class="stat-num mono">{stats.streak}</div><div class="stat-label">Streak</div></div>
          <div><div class="stat-num mono">{stats.maxStreak}</div><div class="stat-label">Best</div></div>
        </div>
        <div class="dist" aria-label="Guess distribution">
          {stats.dist.map((v, i) => (
            <div class="dist-row" key={i}>
              <span style={{ width: 12 }}>{labels[i]}</span>
              <span class="dist-bar" style={{ width: `${Math.max(10, (v / max) * 100)}%` }}>{v}</span>
            </div>
          ))}
        </div>
        <h2>Levels · <span class="mono">{stars} ★ / 360</span></h2>
        <div class="dist" aria-label="Stars per world">
          {WORLD_META.map((w) => {
            const earned = worldStars(prog.stars, w.id, defs);
            return (
              <div class="dist-row" key={w.id}>
                <span style={{ width: 90 }}>W{w.id} {w.name}</span>
                <span class="dist-bar star-bar" style={{ width: `${Math.max(10, (earned / 60) * 100)}%` }}>
                  {earned}★
                </span>
              </div>
            );
          })}
        </div>
        <button class="btn btn-secondary" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
