// WICK wordmark: the "I" is a candlestick (body + wick lines). Amber glow on home.
export function Wordmark({ glow = false, height = 30 }: { glow?: boolean; height?: number }) {
  const w = height * (92 / 30);
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 92 30"
      role="img"
      aria-label="WICK"
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(255,176,32,0.55))' } : undefined}
    >
      {/* W */}
      <path
        d="M2 6 L9 24 L15 12 L21 24 L28 6"
        fill="none"
        stroke="currentColor"
        stroke-width="4.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      {/* I = candlestick */}
      <line x1="38" y1="2" x2="38" y2="28" stroke="var(--amber)" stroke-width="2.5" stroke-linecap="round" />
      <rect x="32.5" y="9" width="11" height="13" rx="2" fill="var(--amber)" />
      {/* C */}
      <path
        d="M60 10 A8.5 8.5 0 1 0 60 20"
        fill="none"
        stroke="currentColor"
        stroke-width="4.5"
        stroke-linecap="round"
      />
      {/* K */}
      <path
        d="M74 6 L74 24 M74 15 L86 6 M76 17 L87 24"
        fill="none"
        stroke="currentColor"
        stroke-width="4.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
