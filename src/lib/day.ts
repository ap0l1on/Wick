// Day index — M2.1. Single source of truth, UTC.
export const LAUNCH_UTC = Date.UTC(2026, 8, 24); // Sep 24 2026 00:00 UTC (day #1)
export const DAY_MS = 86_400_000;
export const TOTAL_DAYS = 100;

export function dayIndex(now = Date.now()): number {
  return Math.floor((now - LAUNCH_UTC) / DAY_MS) + 1;
}

export function dayState(now = Date.now()): { kind: 'pre' | 'live' | 'post'; day: number } {
  const d = dayIndex(now);
  if (d < 1) return { kind: 'pre', day: d };
  if (d > TOTAL_DAYS) return { kind: 'post', day: d };
  return { kind: 'live', day: d };
}

export function msToNextDay(now = Date.now()): number {
  const d = dayIndex(now);
  const next = LAUNCH_UTC + d * DAY_MS; // start of next day when live/pre
  if (d < 1) return LAUNCH_UTC - now;
  return Math.max(0, next - now);
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
