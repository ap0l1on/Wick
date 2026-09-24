import { useMemo, useRef, useState } from 'preact/hooks';
import type { GuessEntry } from '../lib/guess.ts';
import { suggest } from '../lib/guess.ts';

interface Props {
  list: GuessEntry[];
  disabled: boolean;
  onSubmit: (raw: string) => string | null; // returns error or null
}

export function GuessBox({ list, disabled, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = 'wick-combo-list';

  const options = useMemo(() => suggest(value, list, 6), [value, list]);

  const submit = (raw: string): void => {
    if (disabled) return;
    const err = onSubmit(raw);
    if (err) {
      setError(err);
    } else {
      setError(null);
      setValue('');
      setOpen(false);
      setActive(0);
    }
  };

  return (
    <div class="guess-box" ref={boxRef}>
      <label class="sr-only" for="wick-guess">Name the asset</label>
      <input
        id="wick-guess"
        class="guess-input"
        type="text"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options.length ? `wick-opt-${active}` : undefined}
        placeholder="Name the asset…"
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        value={value}
        disabled={disabled}
        onInput={(e) => {
          setValue((e.target as HTMLInputElement).value);
          setOpen(true);
          setActive(0);
          setError(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && options.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === 'ArrowUp' && options.length) {
            e.preventDefault();
            setActive((a) => (a - 1 + options.length) % options.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && options[active]) submit(options[active].name);
            else submit(value);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && !disabled && (
        <ul class="combo-list" id={listId} role="listbox" aria-label="Matching assets">
          {options.map((o, i) => (
            <li
              key={o.name}
              id={`wick-opt-${i}`}
              role="option"
              aria-selected={i === active}
              class={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(o.name);
              }}
            >
              <span>{o.name}</span>
              <span class="combo-class">{o.class}</span>
            </li>
          ))}
        </ul>
      )}
      <button class="guess-submit" type="button" disabled={disabled} onClick={() => submit(value)}>
        Guess
      </button>
      <p class="form-error" role={error ? 'alert' : undefined}>{error ?? ''}</p>
    </div>
  );
}
