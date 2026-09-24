import { useEffect, useState } from 'preact/hooks';
import { loadWorld, decodeLevelAnswer, type LevelJson, type WorldMeta } from '../lib/worlds.ts';
import { isLevelUnlocked, isWorldUnlocked, worldStars, STARS_TO_UNLOCK_WORLD } from '../lib/levels.ts';
import { levelNumber } from '../lib/share.ts';
import type { LevelDef } from '../lib/levels.ts';
import { loadProgress, type Progress } from '../lib/progress.ts';
import { starString } from '../lib/share.ts';
import { CandleChart } from '../components/CandleChart.tsx';
import { metaFor, flag } from '../lib/chips.ts';

function MiniCandle() {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
      <line x1="13" y1="2" x2="13" y2="28" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <rect x="7" y="9" width="12" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function Map(p: { defs: LevelDef[]; worlds: WorldMeta[]; onPlay: (id: string) => void; onHome: () => void }) {
  const [prog] = useState<Progress>(() => loadProgress());
  const [files, setFiles] = useState<Record<number, LevelJson[]>>({});
  const [card, setCard] = useState<LevelJson | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const w of p.worlds) {
        try {
          const levels = await loadWorld(w.id);
          if (!alive) return;
          setFiles((f) => ({ ...f, [w.id]: levels }));
        } catch {
          /* world stays locked-looking on network failure */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [p.worlds]);

  return (
    <div class="map">
      <div class="map-head">
        <button class="link-btn" type="button" onClick={p.onHome}>
          ‹ Home
        </button>
        <h1>Levels</h1>
      </div>
      {p.worlds.map((w, wi) => {
        const open = isWorldUnlocked(w.id, prog.stars, p.defs);
        const earned = worldStars(prog.stars, w.id, p.defs);
        const levels = files[w.id] ?? [];
        return (
          <section key={w.id} class="world" aria-label={`World ${w.id}: ${w.name}`}>
            <div class="world-banner">
              <span class="mono dim">WORLD {w.id} / 6</span>
              <h2>{w.name}</h2>
              <p class="dim">{w.theme}</p>
              <div class="progress-track" aria-hidden="true">
                <span class="progress-fill" style={{ width: `${Math.round((earned / 60) * 100)}%` }} />
              </div>
              <p class="mono dim small" aria-live="polite">
                {earned} ★ / 60{!open && wi > 0 ? ` · needs ${STARS_TO_UNLOCK_WORLD} ★ from World ${w.id - 1}` : ''}
              </p>
            </div>
            <div class="trail">
              {levels.map((l, i) => {
                const def: LevelDef = { id: l.id, world: l.world, n: l.n };
                const unlocked = open && isLevelUnlocked(def, prog.stars, p.defs);
                const st = prog.stars[l.id] ?? 0;
                const isCur = unlocked && st < 1;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!unlocked}
                    style={{ '--bend': `${i % 2 === 0 ? '-' : ''}${8 + ((i * 37) % 14)}px` } as Record<string, string>}
                    class={`node${isCur ? ' current' : ''}${st > 0 ? ' done' : ''}`}
                    aria-label={`Level ${levelNumber(l.world, l.n)}${st > 0 ? `, ${st} stars` : unlocked ? '' : ', locked'}`}
                    onClick={() => {
                      if (st > 0) setCard(l);
                      else p.onPlay(l.id);
                    }}
                  >
                    <span class="node-candle" aria-hidden="true">
                      <MiniCandle />
                    </span>
                    <span class="node-num mono">#{levelNumber(l.world, l.n)}</span>
                    <span class="node-stars" aria-hidden="true">
                      {st > 0 ? starString(st) : unlocked ? '☆☆☆' : '🔒'}
                    </span>
                  </button>
                );
              })}
              {levels.length === 0 && <p class="dim">Loading world…</p>}
            </div>
          </section>
        );
      })}
      {card && (
        <MiniCard
          level={card}
          stars={prog.stars[card.id] ?? 0}
          onReplay={() => {
            setCard(null);
            p.onPlay(card.id);
          }}
          onClose={() => setCard(null)}
        />
      )}
    </div>
  );
}

function MiniCard(p: { level: LevelJson; stars: number; onReplay: () => void; onClose: () => void }) {
  let answer = { asset: '?', fact: '' };
  try {
    answer = decodeLevelAnswer(p.level);
  } catch {
    /* corrupted payload: card shows the chart only */
  }
  const meta = metaFor(answer.asset);
  return (
    <div class="modal-backdrop" onClick={p.onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={`${answer.asset} recap`} onClick={(e) => e.stopPropagation()}>
        <div class="mini-chart">
          <CandleChart
            d={p.level.chart.d}
            v={p.level.chart.v}
            candles={p.level.chart.candles}
            revealed
            title={answer.asset}
            chartType="candles"
            reduceMotion
            result="none"
          />
        </div>
        <h2>
          {meta ? <span aria-hidden="true">{flag(meta.country)} </span> : null}
          {answer.asset} <span class="mono dim">{starString(p.stars)}</span>
        </h2>
        <p class="story">{answer.fact}</p>
        <div class="result-row">
          <button class="btn btn-secondary" type="button" onClick={p.onClose}>
            Close
          </button>
          <button class="btn btn-primary" type="button" onClick={p.onReplay}>
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}
