// Analytics: Cloudflare Web Analytics counts page views only — it has no
// custom events. track() is a deliberate no-op so the existing call sites
// keep working without sending anything anywhere.
type Props = Record<string, string | number | undefined>;

export function track(_event: string, _props: Props = {}): void {
  /* no custom events — page views only */
}

export function streakBucket(streak: number): string {
  if (streak <= 3) return '2-3';
  if (streak <= 7) return '4-7';
  if (streak <= 14) return '8-14';
  return '15+';
}
