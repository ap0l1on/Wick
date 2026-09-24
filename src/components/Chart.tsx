import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

interface Props {
  dates: string[];
  values: number[];
  revealed: boolean;
  title?: string;
  dateWindow?: string;
}

const W = 1000;
const H = 560;
const PAD_X = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 44; // room for date ticks after reveal

function monthLabel(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return `${months[m - 1]} ${y}`;
}

export function Chart({ dates, values, revealed, title, dateWindow }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const geom = useMemo(() => {
    const n = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const lo = min - span * 0.06;
    const hi = max + span * 0.06;
    const iw = W - PAD_X * 2;
    const ih = H - PAD_TOP - PAD_BOTTOM;
    const x = (i: number): number => PAD_X + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number): number => PAD_TOP + (1 - (v - lo) / (hi - lo)) * ih;
    const pts = values.map((v, i) => ({ x: x(i), y: y(v), v, d: dates[i] }));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${path} L${pts[n - 1].x.toFixed(1)},${(PAD_TOP + ih).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD_TOP + ih).toFixed(1)} Z`;
    const baseY = y(values[0]);
    // extremes + biggest one-day drop for reveal markers
    let hiI = 0;
    let loI = 0;
    let dropI = 0;
    let drop = 0;
    values.forEach((v, i) => {
      if (v > values[hiI]) hiI = i;
      if (v < values[loI]) loI = i;
      if (i > 0 && values[i - 1] > 0) {
        const d = (values[i - 1] - v) / values[i - 1];
        if (d > drop) {
          drop = d;
          dropI = i;
        }
      }
    });
    const first = values[0] || 1;
    const hiPct = Math.round(((values[hiI] - first) / Math.abs(first)) * 100);
    const loPct = Math.round(((values[loI] - first) / Math.abs(first)) * 100);
    // 4 date ticks
    const ticks = n >= 4 ? [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1] : pts.map((_, i) => i);
    return { pts, path, area, baseY, hiI, loI, dropI, hiPct, loPct, ticks, totalLen: 3000 };
  }, [dates, values]);

  const n = values.length;
  const label = revealed
    ? `${title ?? 'Chart'}, ${dateWindow ?? ''}`
    : `Mystery price chart, ${n} data points`;

  const onMove = (e: MouseEvent): void => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    // map client x to viewBox x
    const vx = cx * W;
    let best = 0;
    let bd = Infinity;
    geom.pts.forEach((p, i) => {
      const d = Math.abs(p.x - vx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? geom.pts[hover] : null;
  const hpPct = hp ? Math.round(((hp.v - values[0]) / Math.abs(values[0] || 1)) * 100) : 0;

  // Post-reveal redraw: start hidden, sweep left-to-right over 900ms (instant under reduced motion).
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!revealed || reduceMotion) return;
    setDrawn(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
  }, [revealed, reduceMotion, dates.length]);

  return (
    <div class="chart-wrap">
      <svg
        ref={svgRef}
        class={`chart-svg${revealed && !reduceMotion ? ' pulse' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) onMove(t as unknown as MouseEvent);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) onMove(t as unknown as MouseEvent);
        }}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="wick-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--line)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--line)" stop-opacity="0" />
          </linearGradient>
        </defs>
        {/* area */}
        <path d={geom.area} fill="url(#wick-area)" stroke="none" />
        {/* baseline at first value, pre-reveal */}
        {!revealed && (
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={geom.baseY}
            y2={geom.baseY}
            stroke="var(--muted)"
            stroke-width="1"
            stroke-dasharray="6 6"
          />
        )}
        {/* line */}
        <path
          d={geom.path}
          fill="none"
          stroke="var(--line)"
          stroke-width="3"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
          stroke-dasharray={revealed && !reduceMotion ? geom.totalLen : undefined}
          stroke-dashoffset={revealed && !reduceMotion ? (drawn ? 0 : geom.totalLen) : undefined}
          style={
            revealed && !reduceMotion
              ? { transition: 'stroke-dashoffset 900ms ease' }
              : undefined
          }
        />
        {/* crosshair */}
        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={PAD_TOP} y2={H - PAD_BOTTOM} stroke="var(--muted)" stroke-width="1" />
            <circle cx={hp.x} cy={hp.y} r="7" fill="var(--line)" />
          </g>
        )}
        {/* reveal extras */}
        {revealed && (
          <g>
            {geom.ticks.map((ti) => (
              <text
                key={ti}
                x={geom.pts[ti].x}
                y={H - 12}
                text-anchor="middle"
                class="axis-label"
              >
                {monthLabel(geom.pts[ti].d)}
              </text>
            ))}
            <text x={geom.pts[geom.hiI].x} y={Math.max(geom.pts[geom.hiI].y - 12, 20)} text-anchor="middle" class="pct-label">
              +{geom.hiPct}%
            </text>
            <text x={geom.pts[geom.loI].x} y={Math.min(geom.pts[geom.loI].y + 30, H - PAD_BOTTOM - 6)} text-anchor="middle" class="pct-label">
              {geom.loPct}%
            </text>
            <circle cx={geom.pts[geom.loI].x} cy={geom.pts[geom.loI].y} r="8" fill="none" stroke="var(--text)" stroke-width="2" />
            <circle cx={geom.pts[geom.hiI].x} cy={geom.pts[geom.hiI].y} r="8" fill="none" stroke="var(--text)" stroke-width="2" />
            <circle cx={geom.pts[geom.dropI].x} cy={geom.pts[geom.dropI].y} r="8" fill="none" stroke="var(--wrong)" stroke-width="2" />
          </g>
        )}
      </svg>
      <div class="chart-tip" aria-live="polite">
        {hp ? `${hpPct >= 0 ? '+' : ''}${hpPct}% from start${revealed ? ` · ${hp.d}` : ''}` : revealed ? 'Low, peak and biggest one-day drop marked' : 'Touch or hover to inspect · % from start'}
      </div>
    </div>
  );
}
