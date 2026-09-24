// Guess matching — M2.2. Asset-level, case- and accent-insensitive, alias-aware.
export interface GuessEntry {
  name: string;
  aliases: string[];
  class: string;
}

export type Tile = 'right' | 'near' | 'wrong';

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Turkish dotless ı has no decomposition — map it so 'LİRASI' matches 'Lirası'.
    .replace(/ı/g, 'i')
    .trim();

export function entryKeys(e: GuessEntry): string[] {
  return [e.name, ...(e.aliases ?? [])].map(fold);
}

export function buildLookup(list: GuessEntry[]): Map<string, GuessEntry> {
  const m = new Map<string, GuessEntry>();
  for (const e of list) {
    for (const k of entryKeys(e)) {
      if (!m.has(k)) m.set(k, e);
    }
  }
  return m;
}

/** Exact match on name or alias after folding. Returns null for free text. */
export function matchGuess(input: string, lookup: Map<string, GuessEntry>): GuessEntry | null {
  const k = fold(input);
  if (!k) return null;
  return lookup.get(k) ?? null;
}

/** Prefix/substring suggestions, up to 6, for the combobox. */
export function suggest(input: string, list: GuessEntry[], limit = 6): GuessEntry[] {
  const k = fold(input);
  if (!k) return [];
  const starts: GuessEntry[] = [];
  const contains: GuessEntry[] = [];
  for (const e of list) {
    const keys = entryKeys(e);
    if (keys.some((x) => x.startsWith(k))) starts.push(e);
    else if (keys.some((x) => x.includes(k)) || fold(e.name).includes(k)) contains.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function tileFor(guessClass: string, answerAsset: string, guessAsset: string, answerClass: string): Tile {
  if (fold(guessAsset) === fold(answerAsset)) return 'right';
  // Alias equivalence is resolved by the caller: it passes canonical asset names.
  if (guessClass === answerClass) return 'near';
  return 'wrong';
}

/** Canonical asset compare. Guess-list entry names are canonical, so only an
 *  exact (folded) asset match counts — an entry merely named after an alias
 *  does not. `_answerAliases` is kept so callers don't change. */
export function isCorrectAsset(guess: GuessEntry, answerAsset: string, _answerAliases: string[]): boolean {
  void _answerAliases;
  return fold(guess.name) === fold(answerAsset);
}
