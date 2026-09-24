import type { Stats } from '../lib/storage.ts';

export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <p>Name the asset behind today&apos;s chart in 5 guesses.</p>
        <p>🟩 right. 🟨 right type of asset, wrong one. 🟥 wrong type.</p>
        <p>Every wrong guess unlocks a hint. Every chart is a real, famous moment: crashes, squeezes, bubbles and IPOs.</p>
        <button class="btn btn-primary" type="button" onClick={onClose}>Play</button>
      </div>
    </div>
  );
}

export function StatsModal({ stats, onClose }: { stats: Stats; onClose: () => void }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...stats.dist);
  const labels = ['1', '2', '3', '4', '5', 'X'];
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Statistics" onClick={(e) => e.stopPropagation()}>
        <h2>Statistics</h2>
        <div class="stats-grid">
          <div><div class="stat-num">{stats.played}</div><div class="stat-label">Played</div></div>
          <div><div class="stat-num">{winPct}</div><div class="stat-label">Win %</div></div>
          <div><div class="stat-num">{stats.streak}</div><div class="stat-label">Streak</div></div>
          <div><div class="stat-num">{stats.maxStreak}</div><div class="stat-label">Max</div></div>
        </div>
        <div class="dist" aria-label="Guess distribution">
          {stats.dist.map((v, i) => (
            <div class="dist-row" key={i}>
              <span style={{ width: 12 }}>{labels[i]}</span>
              <span class="dist-bar" style={{ width: `${Math.max(10, (v / max) * 100)}%` }}>{v}</span>
            </div>
          ))}
        </div>
        <button class="btn btn-secondary" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
