// Builds public/puzzles.json from data/puzzles.catalog.json.
// Runs ONLY inside GitHub Actions (.github/workflows/build-puzzles.yml) on GitHub's servers.
// Nobody runs it on their own computer; it needs no API key.
//   npx tsx scripts/build-puzzles.ts            # build, fail loudly if any puzzle isn't as extreme as claimed
//   npx tsx scripts/build-puzzles.ts --swap     # replace failing puzzles with a passing reserve of the same class
// Needs: npm i yahoo-finance2
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { clean, stats, check, downsample, normalize, moveHint, yearsHint, obfuscate, type Expect, type RawPoint } from './transform.ts';

// yahoo-finance2 v4: default export is a class (v2's singleton is gone).
const { default: YahooFinance } = await import('yahoo-finance2');
const yf = new YahooFinance();

interface Item {
  key: string; answer: string; title: string; asset: string; aliases: string[]; class: string; symbol: string;
  start: string; end: string; expect: Expect; hintSector: string; hintClue: string; story: string;
  difficulty: 1 | 2 | 3; day?: number; date?: string; tv?: string; tvUrl?: string;
}
const CLASS_LABEL: Record<string, string> = { crypto: 'Cryptocurrency', stock: 'Stock', index: 'Stock market index', commodity: 'Commodity', currency: 'Currency pair', etf: 'Fund (ETF)' };
const OBF_KEY = 'wick-v1'; // public on purpose: this only stops casual peeking

const catalog = JSON.parse(readFileSync('data/puzzles.catalog.json', 'utf8')) as { launch: string; puzzles: Item[]; reserves: Item[] };
const swap = process.argv.includes('--swap');

async function fetchDaily(symbol: string, start: string, end: string): Promise<RawPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any, lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {           // retry with backoff: 2s, 4s, 8s
    try { res = await yf.chart(symbol, { period1: start, period2: end, interval: '1d' }); break; }
    catch (e) { lastErr = e; if (attempt < 4) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); }
  }
  if (!res) throw lastErr;
  return clean(res.quotes.map((q: { date: Date; close: number | null; adjclose?: number | null }) => ({
    date: q.date.toISOString().slice(0, 10),
    close: (q.adjclose ?? q.close) as number, // split-adjusted where available
  })));
}

type Built = { ok: true; item: Item; out: Record<string, unknown>; note: string } | { ok: false; item: Item; note: string };

async function build(item: Item): Promise<Built> {
  try {
    const raw = await fetchDaily(item.symbol, item.start, item.end);
    const s = stats(raw);
    const fails = check(s, item.expect);
    if (fails.length) return { ok: false, item, note: fails.join('; ') };
    const shape = normalize(downsample(raw, 120));
    return {
      ok: true, item, note: `rise ${s.rise.multiple.toFixed(1)}x, dd ${(s.drawdown.pct * 100).toFixed(0)}%, cliff ${(s.cliff.pct * 100).toFixed(0)}%, ${raw.length} days`,
      out: {
        day: item.day, date: item.date, difficulty: item.difficulty,
        chart: shape,                                   // dates + index (first = 100); no real prices
        hints: [CLASS_LABEL[item.class], yearsHint(s), moveHint(s, item.expect), item.hintSector, item.hintClue],
        answer: obfuscate(JSON.stringify({ key: item.key, asset: item.asset, title: item.title, aliases: item.aliases, story: item.story, tvUrl: item.tvUrl }), OBF_KEY + item.day),
      },
    };
  } catch (e) {
    return { ok: false, item, note: `fetch/parse error: ${(e as Error).message}` };
  }
}

const results: Built[] = await buildAll(catalog.puzzles, 'puzzle');
const reserveResults: Built[] = await buildAll(catalog.reserves, 'reserve');

/** Build items with a small worker pool so the log shows live progress and the
 *  run takes minutes, not half an hour. Workers pull from a shared queue;
 *  each fetch keeps its own retries, so one slow symbol never blocks the rest. */
async function buildAll(items: Item[], label: string): Promise<Built[]> {
  const CONCURRENCY = 5;
  const out: Built[] = new Array(items.length);
  const total = items.length;
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++;
      const item = items[i];
      const r = await build(item);
      out[i] = r;
      done++;
      const day = item.day ?? '-';
      console.log(`[${label} ${done}/${total}] day ${day} ${item.answer} ${r.ok ? 'PASS' : 'FAIL'} — ${r.note}`);
      await new Promise((res) => setTimeout(res, 200)); // pacing between requests
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
  return out;
}

const usable = reserveResults.filter(r => r.ok) as Extract<Built, { ok: true }>[];
const final: Record<string, unknown>[] = [];
const report: string[] = ['| Day | Date | Answer | Symbol | Result | Note |', '| --- | --- | --- | --- | --- | --- |'];
for (const r of results) {
  if (r.ok) { final.push(r.out); report.push(`| ${r.item.day} | ${r.item.date} | ${r.item.answer} | ${r.item.symbol} | PASS | ${r.note} |`); continue; }
  report.push(`| ${r.item.day} | ${r.item.date} | ${r.item.answer} | ${r.item.symbol} | FAIL | ${r.note} |`);
  if (swap) {
    const i = usable.findIndex(u => u.item.class === r.item.class) >= 0 ? usable.findIndex(u => u.item.class === r.item.class) : 0;
    const sub = usable.splice(i, 1)[0];
    if (sub) {
      const rebuilt = await build({ ...sub.item, day: r.item.day, date: r.item.date });
      console.log(`[swap] day ${r.item.day} ↳ ${sub.item.answer} ${rebuilt.ok ? 'SWAPPED IN' : 'STILL FAILING'} — ${rebuilt.note}`);
      if (rebuilt.ok) { final.push(rebuilt.out); report.push(`| ${r.item.day} | ${r.item.date} | ↳ ${sub.item.answer} | ${sub.item.symbol} | SWAPPED IN | ${rebuilt.note} |`); }
    }
  }
}
report.push('', '**Reserves**', '', '| Answer | Symbol | Result | Note |', '| --- | --- | --- | --- |', ...reserveResults.map(r => `| ${r.item.answer} | ${r.item.symbol} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`));

mkdirSync('public', { recursive: true });
writeFileSync('public/puzzles.json', JSON.stringify({ version: 1, launch: catalog.launch, puzzles: final.sort((a, b) => (a.day as number) - (b.day as number)) }));
writeFileSync('data/build-report.md', report.join('\n') + '\n');
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} puzzles passed; ${usable.length} reserves unused. Report: data/build-report.md`);
if (final.length < catalog.puzzles.length) process.exit(1);
