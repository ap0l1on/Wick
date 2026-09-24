// Share text — exact formats, never contains answer or hints.
export function shareText(day: number, guesses: ('right' | 'near' | 'wrong')[], won: boolean, domain: string): string {
  const tile = (t: string): string => (t === 'right' ? '🟩' : t === 'near' ? '🟨' : '🟥');
  const row = guesses.map(tile).join('');
  const score = won ? `${guesses.length}/5` : 'X/5';
  return `Wick #${day} ${score}\n${row}\n${domain}`;
}

/** Global level number across worlds: (world-1)*20 + n. */
export function levelNumber(world: number, n: number): number {
  return (world - 1) * 20 + n;
}

export function starString(stars: number): string {
  const s = Math.min(Math.max(Math.floor(stars), 0), 3);
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}

/** Levels share: `Wick · Level 23 ★★★` + site, no guesses or progress in URLs. */
export function shareLevelText(world: number, n: number, stars: number, site: string): string {
  return `Wick · Level ${levelNumber(world, n)} ${starString(stars)}\n${site}`;
}

export function siteDomain(): string {
  // Never hard-coded: bare host + path of the page being played.
  try {
    return window.location.host + window.location.pathname;
  } catch {
    return 'example.com/Wick/';
  }
}
