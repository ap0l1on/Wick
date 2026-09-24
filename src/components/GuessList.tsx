interface Row {
  name: string;
  class: string;
  tile: 'right' | 'near' | 'wrong';
}

const ICON: Record<Row['tile'], string> = { right: '✓', near: '~', wrong: '✕' };
const LABEL: Record<Row['tile'], string> = { right: 'Correct asset', near: 'Right type, wrong asset', wrong: 'Wrong type' };

export function GuessList({ guesses }: { guesses: Row[] }) {
  const slots: (Row | null)[] = [0, 1, 2, 3, 4].map((i) => guesses[i] ?? null);
  return (
    <ol class="guesses" aria-live="polite" aria-label="Your guesses">
      {slots.map((g, i) =>
        g ? (
          <li key={i} class="guess">
            <span class={`tile ${g.tile}`} aria-hidden="true">{ICON[g.tile]}</span>
            <span>
              <span class="guess-name">{g.name}</span>
              <span class="guess-class">{g.class} · {LABEL[g.tile]}</span>
            </span>
          </li>
        ) : (
          <li key={i} class="guess guess-slot-empty" aria-hidden="true">
            <span class="tile" style={{ background: 'var(--surface-2)' }} />
            <span>Guess {i + 1} of 5</span>
          </li>
        ),
      )}
    </ol>
  );
}
