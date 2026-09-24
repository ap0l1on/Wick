// Share text — M2.7 exact format, never contains answer or hints.
export function shareText(day: number, guesses: ('right' | 'near' | 'wrong')[], won: boolean, domain: string): string {
  const tile = (t: string): string => (t === 'right' ? '🟩' : t === 'near' ? '🟨' : '🟥');
  const row = guesses.map(tile).join('');
  const score = won ? `${guesses.length}/5` : 'X/5';
  return `Wick #${day} ${score}\n${row}\n${domain}`;
}

export function siteDomain(): string {
  // Never hard-coded: bare host + path of the page being played.
  try {
    return window.location.host + window.location.pathname;
  } catch {
    return 'example.com/wick/';
  }
}
