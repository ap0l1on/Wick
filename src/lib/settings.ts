// UI settings: chart style, motion, colour-blind mode. Persisted, schema-checked.
export interface Settings {
  chart: 'candles' | 'line';
  reduceMotion: boolean;
  colorBlind: boolean;
}

const KEY = 'wick.settings.v1';
const DEFAULTS: Settings = { chart: 'candles', reduceMotion: false, colorBlind: false };

function parse(v: unknown): Settings | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.chart !== 'candles' && o.chart !== 'line') return null;
  if (typeof o.reduceMotion !== 'boolean' || typeof o.colorBlind !== 'boolean') return null;
  return { chart: o.chart, reduceMotion: o.reduceMotion, colorBlind: o.colorBlind };
}

function systemReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, reduceMotion: systemReducedMotion() };
    const p = parse(JSON.parse(raw));
    if (!p) return { ...DEFAULTS, reduceMotion: systemReducedMotion() };
    return p;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
  applySettings(s);
}

/** Push settings to the DOM (colour-blind palette + motion gate for CSS). */
export function applySettings(s: Settings): void {
  try {
    const el = document.documentElement;
    el.dataset.cb = s.colorBlind ? '1' : '0';
    const reduced = s.reduceMotion || systemReducedMotion();
    el.dataset.motion = reduced ? 'reduced' : 'full';
  } catch {
    /* non-DOM (tests) */
  }
}

export function motionOK(s: Settings): boolean {
  return !(s.reduceMotion || systemReducedMotion());
}

export function vibrate(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
