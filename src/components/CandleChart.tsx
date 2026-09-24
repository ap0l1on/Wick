import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { CandleData } from '../lib/worlds.ts';

interface Props {
  d: string[];
  v: number[];
  candles?: CandleData;
  revealed: boolean;
  title?: string;
  dateWindow?: string;
  chartType: 'candles' | 'line';
  reduceMotion: boolean;
  result: 'none' | 'win' | 'loss';
}

const W = 1000;
const H = 560;
const PAD_X = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 44;
const PAD_RIGHT = 64; // room for the % axis

let clipSeq = 0;

function monthLabel(iso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return `${months[m - 1]} ${y}`;
}

export function CandleChart(p: Props) {
  const hasCandles = p.chartType === 'candles' && p.candles && p.candles.c.length > 1;
  const total = hasCandles ? (p.candles?.c.length ?? 0) : p.v.length;
  const [view, setView] = useState<[number, number]>([0, Math.max(0, total - 1)]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; a: number; b: number } | null>(null);
  const pinch = useRef<{ d: number; a: number; b: number } | null>(null);
  const clipId = useRef(`wick-clip-${(clipSeq += 1)}`);

  // Reset the window when the data changes.
  useEffect(() => {
    setView([0, Math.max(0, total - 1)]);
    setHover(null);
  }, [total, p.d.length]);

  const geom = useMemo(() => {
    const [a, b] = view;
    const n = Math.max(1, b - a + 1);
    const iw = W - PAD_X - PAD_RIGHT;
    const ih = H - PAD_TOP - PAD_BOTTOM;
    const all = hasCandles ? [...(p.candles?.h ?? []), ...(p.candles?.l ?? [])] : p.v;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const lo = min - span * 0.06;
    const hi = max + span * 0.06;
    const x = (i: number): number => PAD_X + (n <= 1 ? iw / 2 : ((i - a) / (n - 1)) * iw);
    const y = (v: number): number => PAD_TOP + (1 - (v - lo) / (hi - lo)) * ih;
    const base = Math.abs(p.v[0] || 1);
    const pct = (v: number): number => Math.round(((v - p.v[0]) / base) * 100);
    const line = p.v.map((v, i) => ({ x: x(i), y: y(v), v, d: p.d[i] }));
    const path = line
      .filter((_, i) => i >= a && i <= b)
      .map((pt, k) => `${k === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
    const cd = p.candles;
    const sticks =
      hasCandles && cd
        ? cd.c
            .map((c, i) => ({ i, o: cd.o[i], h: cd.h[i], l: cd.l[i], c }))
            .filter((s) => s.i >= a && s.i <= b)
            .map((s) => {
              const up = s.c >= s.o;
              const bw = Math.max(2, (iw / n) * 0.55);
              return {
                i: s.i,
                x: x(s.i),
                yo: y(s.o),
                yh: y(s.h),
                yl: y(s.l),
                yc: y(s.c),
                top: Math.min(y(s.o), y(s.c)),
                hgt: Math.max(2, Math.abs(y(s.o) - y(s.c))),
                bw,
                up,
                d: cd.d[s.i],
              };
            })
        : [];
    // % axis: 4 ticks across the visible range
    const axisVals = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
    const ticks = n >= 4 ? [a, a + Math.floor((n - 1) / 3), a + Math.floor(((n - 1) * 2) / 3), b] : line.filter((_, i) => i >= a && i <= b).map((pt) => p.d.indexOf(pt.d));
    return { x, y, pct, line, path, sticks, axisVals, ticks, n, iw };
  }, [view, p.v, p.d, p.candles, hasCandles]);

  // Draw-in sweep on mount (instant under reduced motion).
  const [drawn, setDrawn] = useState(p.reduceMotion);
  const clipRect = useRef<SVGRectElement>(null);
  useEffect(() => {
    if (p.reduceMotion) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number): void => {
      const k = Math.min(1, (t - t0) / 600);
      if (k >= 1) setDrawn(true);
      clipRect.current?.setAttribute('width', String((PAD_X + geom.iw + PAD_RIGHT) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.reduceMotion, total]);

  const clampView = (a: number, b: number): [number, number] => {
    const len = Math.min(10, total);
    let na = Math.round(a);
    let nb = Math.round(b);
    if (nb - na + 1 < len) {
      const mid = (na + nb) / 2;
      na = Math.round(mid - (len - 1) / 2);
      nb = na + len - 1;
    }
    if (na < 0) {
      nb -= na;
      na = 0;
    }
    if (nb > total - 1) {
      na -= nb - (total - 1);
      nb = total - 1;
    }
    na = Math.max(0, na);
    return [na, Math.max(na, nb)];
  };

  const toIndex = (clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    const [a, b] = view;
    const n = Math.max(1, b - a + 1);
    const iw = W - PAD_X - PAD_RIGHT;
    const rel = (vx - PAD_X) / (iw || 1);
    return Math.min(b, Math.max(a, a + Math.round(rel * (n - 1))));
  };

  const onPointerDown = (e: PointerEvent): void => {
    (e.target as Element).setPointerCapture?.((e as PointerEvent).pointerId);
    drag.current = { x: e.clientX, a: view[0], b: view[1] };
  };
  const onPointerMove = (e: PointerEvent): void => {
    const svg = svgRef.current;
    if (!svg) return;
    if (drag.current) {
      const rect = svg.getBoundingClientRect();
      const perPx = (view[1] - view[0] + 1) / (rect.width || 1);
      const d = Math.round((e.clientX - drag.current.x) * perPx);
      if (d !== 0) setView(clampView(drag.current.a - d, drag.current.b - d));
    } else {
      setHover(toIndex(e.clientX));
    }
  };
  const onPointerUp = (): void => {
    drag.current = null;
    pinch.current = null;
  };
  const onWheel = (e: WheelEvent): void => {
    const [a, b] = view;
    const mid = (a + b) / 2;
    const span = (b - a + 1) * (e.deltaY > 0 ? 1.2 : 0.84);
    setView(clampView(mid - (span - 1) / 2, mid + (span - 1) / 2));
  };
  // Native non-passive wheel listener so pinch-zoom gestures never scroll the page.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const fn = (e: WheelEvent): void => {
      e.preventDefault();
      onWheel(e);
    };
    svg.addEventListener('wheel', fn, { passive: false });
    return () => svg.removeEventListener('wheel', fn);
  });
  const onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      const [t0, t1] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const prev = pinch.current;
      drag.current = null;
      if (prev && Math.abs(d - prev.d) > 4) {
        const mid = (prev.a + prev.b) / 2;
        const span = (prev.b - prev.a + 1) * (d > prev.d ? 0.9 : 1.1);
        const nv = clampView(mid - (span - 1) / 2, mid + (span - 1) / 2);
        setView(nv);
        pinch.current = { d, a: nv[0], b: nv[1] };
      } else if (!prev) {
        pinch.current = { d, a: view[0], b: view[1] };
      }
    }
  };

  const hp = hover !== null && hover >= view[0] && hover <= view[1] ? hover : null;
  const hpVal = hp !== null ? (hasCandles && p.candles ? p.candles.c[hp] : p.v[hp]) : 0;
  const hpPct = hp !== null ? geom.pct(hpVal) : 0;
  const label = p.revealed
    ? `${p.title ?? 'Chart'}, ${p.dateWindow ?? ''}`
    : `Mystery price chart, ${total} data points. Drag to pan, scroll or pinch to zoom.`;

  return (
    <div class="chart-wrap">
      <div class={`chart-scan${p.result === 'win' ? ' pulse' : ''}${p.result === 'loss' ? ' flash' : ''}`}>
        <svg
          ref={svgRef}
          class="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={label}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            setHover(null);
            onPointerUp();
          }}
          onTouchMove={onTouchMove}
          onDblClick={() => setView([0, total - 1])}
        >
          <defs>
            <linearGradient id="wick-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--line)" stop-opacity="0.22" />
              <stop offset="100%" stop-color="var(--line)" stop-opacity="0" />
            </linearGradient>
            <clipPath id={clipId.current}>
              <rect ref={clipRect} x="0" y="0" width={drawn ? W : 0} height={H} />
            </clipPath>
          </defs>
          {/* gridlines */}
          {geom.axisVals.map((v, i) => (
            <line
              key={i}
              x1={PAD_X}
              x2={W - PAD_RIGHT}
              y1={geom.y(v)}
              y2={geom.y(v)}
              stroke="var(--grid)"
              stroke-width="1"
            />
          ))}
          <g clip-path={drawn ? undefined : `url(#${clipId.current})`}>
            {hasCandles ? (
              <g class="candles">
                {geom.sticks.map((s) => (
                  <g key={s.i} stroke={s.up ? 'var(--bull)' : 'var(--bear)'}>
                    <line x1={s.x} x2={s.x} y1={s.yh} y2={s.yl} stroke-width="2" />
                    <rect
                      x={s.x - s.bw / 2}
                      y={s.top}
                      width={s.bw}
                      height={s.hgt}
                      rx="1.5"
                      fill={s.up ? 'var(--bull)' : 'var(--bear)'}
                      stroke="none"
                      opacity={s.up ? 0.9 : 0.95}
                    />
                  </g>
                ))}
              </g>
            ) : (
              <g>
                <path d={`${geom.path} L${W - PAD_RIGHT},${(H - PAD_BOTTOM).toFixed(1)} L${PAD_X},${(H - PAD_BOTTOM).toFixed(1)} Z`} fill="url(#wick-area)" stroke="none" />
                <path
                  d={geom.path}
                  fill="none"
                  stroke="var(--line)"
                  stroke-width="3"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
              </g>
            )}
          </g>
          {/* % axis */}
          {geom.axisVals.map((v, i) => (
            <text key={i} x={W - PAD_RIGHT + 8} y={geom.y(v) + 7} class="axis-label mono">
              {geom.pct(v) >= 0 ? '+' : ''}{geom.pct(v)}%
            </text>
          ))}
          {/* hover crosshair */}
          {hp !== null && (
            <g>
              <line
                x1={geom.x(hp)}
                x2={geom.x(hp)}
                y1={PAD_TOP}
                y2={H - PAD_BOTTOM}
                stroke="var(--muted)"
                stroke-width="1"
              />
              <circle cx={geom.x(hp)} cy={geom.y(hpVal)} r="7" fill="var(--amber)" />
            </g>
          )}
          {/* reveal labels */}
          {p.revealed && (
            <g class="reveal-labels">
              {geom.ticks.map((ti) => (
                <text key={ti} x={geom.x(ti)} y={H - 12} text-anchor="middle" class="axis-label">
                  {monthLabel(p.d[ti] ?? '')}
                </text>
              ))}
              {p.title && (
                <text x={PAD_X} y={22} text-anchor="start" class="pct-label mono">
                  {p.title}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>
      <div class="chart-tip" aria-live="polite">
        {hp !== null
          ? `${hpPct >= 0 ? '+' : ''}${hpPct}% from start${p.revealed ? ` · ${p.d[hp] ?? ''}` : ''}`
          : 'Drag to pan · scroll or pinch to zoom · double-click to reset'}
      </div>
    </div>
  );
}
