import { useMemo, useState } from 'preact/hooks';
import type { ComponentChild } from 'preact';
import { CandleChart } from '../components/CandleChart.tsx';
import { GuessBox } from '../components/GuessBox.tsx';
import { CandlePips } from '../components/bits.tsx';
import { buildLookup, isCorrectAsset, matchGuess, type GuessEntry } from '../lib/guess.ts';
import { feedbackChips } from '../lib/chips.ts';
import type { CandleData } from '../lib/worlds.ts';
import type { DayGame } from '../lib/storage.ts';
import type { Settings } from '../lib/settings.ts';
import { motionOK, vibrate } from '../lib/settings.ts';
import guessListData from '../../data/guess-list.json';

const GUESS_LIST = guessListData as GuessEntry[];

const CLASS_LABEL: Record<string, string> = {
  crypto: 'Crypto',
  stock: 'Stock',
  index: 'Index',
  commodity: 'Commodity',
  currency: 'Currency',
  etf: 'ETF',
  fund: 'ETF',
};

export interface GameProps {
  modeLabel: string;
  title: string;
  difficulty: number;
  dates: string[];
  values: number[];
  candles?: CandleData;
  answerAsset: string;
  answerAliases: string[];
  answerClass: string;
  /** Starting attempt (daily: restored from storage; levels: null). */
  initial: DayGame | null;
  onPersist: (g: DayGame) => void;
  onFinish: (r: { won: boolean; guesses: number; hintsUsed: number }) => void;
  /** 'auto': daily hint ladder; 'manual': Levels hint buttons. */
  hintsMode: 'auto' | 'manual';
  hintTexts: string[];
  /** Manual mode: reveal hint 0 free once wrongCount reaches this (0 disables). */
  freeHintAfter: number;
  settings: Settings;
  onOpenSettings: () => void;
  /** Parent-owned result card, rendered when finished. */
  result: ComponentChild;
  revealTitle?: string;
  revealDates?: string;
}

export function Game(gp: GameProps) {
  const [game, setGame] = useState<DayGame>(
    () => gp.initial ?? { guesses: [], finished: false, won: false },
  );
  const [usedHints, setUsedHints] = useState<boolean[]>(() => gp.hintTexts.map(() => false));
  const [manualHints, setManualHints] = useState(0);
  const [freeGiven, setFreeGiven] = useState(false);

  const lookup = useMemo(() => buildLookup(GUESS_LIST), []);
  const finished = game.finished;
  const guesses = game.guesses;
  const wrongCount = guesses.filter((x) => x.tile !== 'right').length;

  // Manual hints: free hint for early worlds + tap-to-reveal (each caps a star).
  const useHint = (i: number): void => {
    if (finished || usedHints[i]) return;
    const next = [...usedHints];
    next[i] = true;
    setUsedHints(next);
    setManualHints((n) => n + 1);
  };
  const hintsUsed = gp.hintsMode === 'manual' ? manualHints : 0;
  // Auto hint ladder (daily): hint 1 from the start, one more per wrong guess.
  const visibleAuto = finished ? gp.hintTexts.length : Math.min(gp.hintTexts.length, 1 + wrongCount);

  const persist = (g: DayGame): void => {
    setGame(g);
    gp.onPersist(g);
  };

  const finish = (g: DayGame, won: boolean): void => {
    const done: DayGame = { ...g, finished: true, won };
    persist(done);
    gp.onFinish({ won, guesses: done.guesses.length, hintsUsed });
  };

  const submitGuess = (raw: string): string | null => {
    if (finished) return 'Game over.';
    if (motionOK(gp.settings)) vibrate(10);
    const entry = matchGuess(raw, lookup);
    if (!entry) return 'Pick one from the list';
    if (guesses.some((x) => x.name === entry.name)) return 'Already guessed';
    const correct = isCorrectAsset(entry, gp.answerAsset, gp.answerAliases);
    const t = correct ? 'right' : entry.class === gp.answerClass ? 'near' : 'wrong';
    const row = { name: entry.name, class: entry.class, tile: t as 'right' | 'near' | 'wrong' };
    const next: DayGame = { guesses: [...guesses, row], finished: false, won: false };
    // free early hint (worlds 1–2): reveal hint 0 without costing a star
    if (gp.hintsMode === 'manual' && gp.freeHintAfter > 0 && !freeGiven && !usedHints[0]) {
      const upcomingWrong = wrongCount + (correct ? 0 : 1);
      if (upcomingWrong >= gp.freeHintAfter) {
        const hu = [...usedHints];
        hu[0] = true;
        setUsedHints(hu);
        setFreeGiven(true);
      }
    }
    if (correct) {
      finish({ ...next, finished: true, won: true }, true);
      return null;
    }
    if (next.guesses.length >= 5) {
      finish(next, false);
      return null;
    }
    persist(next);
    return null;
  };

  const answerRef = { name: gp.answerAsset, class: gp.answerClass };

  return (
    <div>
      <div class="game-topbar">
        <span class="mode-label mono">{gp.modeLabel}</span>
        <CandlePips used={guesses.length} />
        <button class="icon-btn" type="button" aria-label="Settings" onClick={gp.onOpenSettings}>
          ⚙
        </button>
      </div>
      <div class="title-row">
        <h1>{gp.title}</h1>
        <span class="dots" aria-label={`Difficulty ${gp.difficulty}`}>
          {'●'.repeat(gp.difficulty)}
        </span>
      </div>
      <section class="card chart-card" aria-label="Price chart">
        <CandleChart
          d={gp.dates}
          v={gp.values}
          candles={gp.candles}
          revealed={finished}
          title={finished ? gp.revealTitle : undefined}
          dateWindow={finished ? gp.revealDates : undefined}
          chartType={gp.settings.chart}
          reduceMotion={!motionOK(gp.settings)}
          result={finished ? (game.won ? 'win' : 'loss') : 'none'}
        />
      </section>
      {gp.hintsMode === 'auto' ? (
        <ul class="hints" aria-label="Hints">
          {gp.hintTexts.slice(0, visibleAuto).map((h, i) => (
            <li key={i} class="hint">
              <span class="n">Hint {i + 1}</span>
              {h}
            </li>
          ))}
          {Array.from({ length: gp.hintTexts.length - visibleAuto }, (_, k) => (
            <li key={`l${k}`} class="hint locked" aria-hidden="true">
              <span class="n">Hint {visibleAuto + k + 1}</span>
              🔒 Wrong guesses unlock more hints
            </li>
          ))}
        </ul>
      ) : (
        <div class="hint-btns" role="group" aria-label="Hints (each costs a star)">
          {gp.hintTexts.map((h, i) => (
            <div key={i} class="hint-btn-wrap">
              <button
                class="btn btn-hint"
                type="button"
                disabled={finished || usedHints[i]}
                onClick={() => useHint(i)}
                aria-label={usedHints[i] ? `Hint ${i + 1} revealed: ${h}` : `Reveal hint ${i + 1}, costs a star`}
              >
                {usedHints[i] ? `💡 ${h}` : `💡 Hint ${i + 1} (−★)`}
              </button>
            </div>
          ))}
        </div>
      )}
      {!finished && <GuessBox list={GUESS_LIST} disabled={false} onSubmit={submitGuess} />}
      <ol class="guesses" aria-live="polite" aria-label="Your guesses">
        {[0, 1, 2, 3, 4].map((i) => {
          const x = guesses[i];
          if (!x) {
            return (
              <li key={i} class="guess guess-slot-empty" aria-hidden="true">
                <span class="tile" style={{ background: 'var(--surface-2)' }} />
                <span>Guess {i + 1} of 5</span>
              </li>
            );
          }
          const chips =
            x.tile === 'wrong'
              ? feedbackChips({ name: x.name, class: x.class }, answerRef)
              : [];
          return (
            <li key={i} class={`guess ${x.tile}`}>
              <span class={`tile ${x.tile}`} aria-hidden="true">
                {x.tile === 'right' ? '✓' : x.tile === 'near' ? '~' : '✕'}
              </span>
              <span class="guess-body">
                <span class="guess-name">{x.name}</span>
                <span class="guess-class">{CLASS_LABEL[x.class] ?? x.class}</span>
                {chips.length > 0 && (
                  <span class="chips">
                    {chips.map((c) => (
                      <span key={c.kind} class={`chip ${c.mark}`}>
                        {c.text}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {finished && gp.result}
    </div>
  );
}

export function windowLabel(d: string[]): string {
  if (!d.length) return '';
  const fmt = (iso: string): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, dd] = iso.split('-').map(Number);
    return `${months[(m ?? 1) - 1]} ${dd}, ${y}`;
  };
  return `${fmt(d[0])} – ${fmt(d[d.length - 1])}`;
}

export function guessClassOf(list: GuessEntry[], asset: string): string | null {
  const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const hit = list.find((e) => norm(e.name) === norm(asset));
  return hit ? hit.class : null;
}
