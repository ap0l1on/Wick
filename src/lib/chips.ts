// Asset metadata + smart feedback chips (Levels deduction game).
// Metadata lives in data/assets.json (built by hand, validated by the build).
// Chips never reveal answer values — only the guess's values plus ✓✗▲▼ marks.
import assetsData from '../../data/assets.json';

export interface AssetMeta {
  ticker: string;
  country: string; // ISO-2, or '--' for global (crypto, commodities)
  sector: string;
  cap: 1 | 2 | 3 | 4 | 5; // coarse bucket; only relative comparisons are shown
}

const META = assetsData as Record<string, AssetMeta>;

export const COUNTRY_NAME: Record<string, string> = {
  US: 'USA', CN: 'China', JP: 'Japan', DE: 'Germany', GB: 'UK', CA: 'Canada',
  BR: 'Brazil', TR: 'Türkiye', IN: 'India', AU: 'Australia', CH: 'Switzerland',
  HK: 'Hong Kong', FI: 'Finland', '--': 'Global',
};

export function metaFor(name: string): AssetMeta | null {
  return META[name] ?? null;
}

export function flag(iso: string): string {
  if (iso === '--') return '🌐';
  if (!/^[A-Z]{2}$/.test(iso)) return '?';
  return String.fromCodePoint(...[...iso].map((c) => 127397 + (c.codePointAt(0) ?? 0)));
}

const TYPE_LABEL: Record<string, string> = {
  crypto: 'Crypto',
  stock: 'Stock',
  index: 'Index',
  commodity: 'Commodity',
  currency: 'Currency',
  etf: 'ETF',
  fund: 'ETF',
};

export function typeLabel(cls: string): string {
  return TYPE_LABEL[cls] ?? cls;
}

export interface Chip {
  kind: 'sector' | 'country' | 'type' | 'cap';
  mark: 'yes' | 'no' | 'up' | 'down' | 'eq' | 'unknown';
  text: string;
}

/** Deductive feedback for one wrong guess. Never contains answer values. */
export function feedbackChips(
  guess: { name: string; class: string },
  answer: { name: string; class: string },
): Chip[] {
  const gm = metaFor(guess.name);
  const am = metaFor(answer.name);
  const sector: Chip =
    gm && am
      ? gm.sector === am.sector
        ? { kind: 'sector', mark: 'yes', text: `${gm.sector} ✓` }
        : { kind: 'sector', mark: 'no', text: `${gm.sector} ✗` }
      : { kind: 'sector', mark: 'unknown', text: '? Sector' };
  const country: Chip =
    gm && am
      ? gm.country === am.country
        ? { kind: 'country', mark: 'yes', text: `${flag(gm.country)} ${COUNTRY_NAME[gm.country] ?? gm.country} ✓` }
        : { kind: 'country', mark: 'no', text: `${flag(gm.country)} ${COUNTRY_NAME[gm.country] ?? gm.country} ✗` }
      : { kind: 'country', mark: 'unknown', text: '? Country' };
  const type: Chip =
    guess.class === answer.class
      ? { kind: 'type', mark: 'yes', text: `${typeLabel(guess.class)} ✓` }
      : { kind: 'type', mark: 'no', text: `${typeLabel(guess.class)} ✗` };
  let cap: Chip;
  if (gm && am) {
    if (am.cap === gm.cap) cap = { kind: 'cap', mark: 'eq', text: 'Cap =' };
    else if (am.cap > gm.cap) cap = { kind: 'cap', mark: 'up', text: 'Cap ▲' };
    else cap = { kind: 'cap', mark: 'down', text: 'Cap ▼' };
  } else {
    cap = { kind: 'cap', mark: 'unknown', text: '? Cap' };
  }
  return [sector, country, type, cap];
}
