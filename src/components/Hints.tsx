export function Hints({ hints, visible }: { hints: string[]; visible: number }) {
  return (
    <ul class="hints" aria-label="Hints">
      {hints.map((h, i) =>
        i < visible ? (
          <li key={i} class="hint"><span class="n">Hint {i + 1}</span>{h}</li>
        ) : (
          <li key={i} class="hint locked">Hint {i + 1} unlocks after a wrong guess</li>
        ),
      )}
    </ul>
  );
}
