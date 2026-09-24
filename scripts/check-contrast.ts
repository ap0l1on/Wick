// WCAG 2.2 AA contrast gate: text/background pairs must hit >= 4.5:1.
// Run: npx tsx scripts/check-contrast.ts (wired into CI).
const PAIRS: [string, string, string, number][] = [
  ['--text on --bg', '#EDEFE6', '#0D0F0C', 4.5],
  ['--muted on --bg', '#8C9585', '#0D0F0C', 4.5],
  ['--amber on --bg', '#FFB020', '#0D0F0C', 4.5],
  ['--accent-text on --amber', '#141004', '#FFB020', 4.5],
  ['--right-text on --right', '#0D0F0C', '#26D07C', 4.5],
  ['--near-text on --near', '#141004', '#FFB020', 4.5],
  ['--star on --bg (large/bold only)', '#FFD34D', '#0D0F0C', 3],
];

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failed = 0;
for (const [name, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${r.toFixed(2)}:1 (needs ${min}:1)`);
}
if (failed) process.exit(1);
