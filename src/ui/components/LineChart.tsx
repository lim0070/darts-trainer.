import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface ChartPoint {
  ts: number;
  v: number;
}

const SURFACE = '#162a3e';
const GRID = '#24405a';
const MUTED = '#8fa6bf';
const INK = '#f1ebdd';
const ACCENT = '#ff4a3d';

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

function rollingAvg(points: ChartPoint[], n: number): number[] {
  return points.map((_, i) => {
    const from = Math.max(0, i - n + 1);
    const slice = points.slice(from, i + 1);
    return slice.reduce((t, p) => t + p.v, 0) / slice.length;
  });
}

const day = (ts: number) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });

/**
 * One metric over time: each game as a quiet line, the rolling average as the
 * accent line, the personal best marked. Crosshair tooltip on hover/keys, table on demand.
 */
export function LineChart({
  points,
  format,
  better = 'high',
  rolling = 10,
  title,
  height = 180,
}: {
  points: ChartPoint[];
  format: (v: number) => string;
  better?: 'high' | 'low';
  rolling?: number | null;
  title: string;
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = points.slice(-200);
  const avg = useMemo(() => (rolling ? rollingAvg(data, rolling) : null), [data, rolling]);
  if (data.length === 0) return null;

  const pad = { l: 40, r: 56, t: 14, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const vals = data.map((p) => p.v);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i: number) => pad.l + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => pad.t + h - ((v - lo) / (hi - lo || 1)) * h;
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const bestIdx = vals.reduce((b, v, i) => ((better === 'high' ? v > vals[b] : v < vals[b]) ? i : b), 0);
  const last = data.length - 1;
  const endVal = avg ? avg[last] : vals[last];

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = data.length === 1 ? 0 : Math.round(((px - pad.l) / w) * (data.length - 1));
    setHover(Math.max(0, Math.min(last, i)));
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? last) - 1));
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(last, (h ?? 0) + 1));
    else return;
    e.preventDefault();
  };

  const hx = hover !== null ? x(hover) : 0;
  const tipLeft = Math.min(Math.max(hx - 70, 0), width - 140);

  return (
    <figure className="stack" style={{ margin: 0 }}>
      <div className="row small muted" style={{ gap: 14 }}>
        {rolling && data.length > 2 ? (
          <>
            <span className="row" style={{ gap: 6 }}>
              <svg width="16" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="16" y2="2" stroke={MUTED} strokeWidth="2" strokeLinecap="round" />
              </svg>
              Each game
            </span>
            <span className="row" style={{ gap: 6 }}>
              <svg width="16" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="16" y2="2" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
              </svg>
              {rolling}-game average
            </span>
          </>
        ) : (
          <span>{title}</span>
        )}
        <button
          className="btn ghost small"
          style={{ marginLeft: 'auto', minHeight: 32, padding: '0 10px' }}
          onClick={() => setTable((t) => !t)}
        >
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              {avg && <th>Average</th>}
            </tr>
          </thead>
          <tbody>
            {data
              .map((p, i) => ({ p, i }))
              .reverse()
              .slice(0, 60)
              .map(({ p, i }) => (
                <tr key={i}>
                  <td>{day(p.ts)}</td>
                  <td>{format(p.v)}</td>
                  {avg && <td>{format(avg[i])}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <div ref={box} style={{ position: 'relative' }}>
          <svg
            className="chart"
            width={width}
            height={height}
            role="img"
            aria-label={`${title}: ${data.length} games, latest ${format(vals[last])}, best ${format(vals[bestIdx])}`}
            tabIndex={0}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
            onKeyDown={keys}
            onBlur={() => setHover(null)}
            style={{ touchAction: 'pan-y' }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {format(t)}
                </text>
              </g>
            ))}
            {data.length > 1 && (
              <path
                d={path(vals)}
                fill="none"
                stroke={avg ? MUTED : ACCENT}
                strokeOpacity={avg ? 0.55 : 1}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {avg && data.length > 1 && (
              <path d={path(avg)} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {data.length <= 2 &&
              vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />)}
            <circle cx={x(bestIdx)} cy={y(vals[bestIdx])} r="5" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
            {bestIdx !== last && (
              <text
                x={Math.min(Math.max(x(bestIdx), pad.l + 20), width - pad.r - 20)}
                y={Math.max(y(vals[bestIdx]) - 10, 11)}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={INK}
              >
                Best {format(vals[bestIdx])}
              </text>
            )}
            <circle cx={x(last)} cy={y(endVal)} r="4" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
            <text x={x(last) + 8} y={y(endVal) + 4} fontSize="12" fontWeight="800" fill={INK}>
              {format(endVal)}
            </text>
            <text x={pad.l} y={height - 6} fontSize="11" fill={MUTED}>
              {day(data[0].ts)}
            </text>
            <text x={width - pad.r} y={height - 6} fontSize="11" fill={MUTED} textAnchor="end">
              {day(data[last].ts)}
            </text>
            {hover !== null && <line x1={hx} x2={hx} y1={pad.t} y2={pad.t + h} stroke={MUTED} strokeWidth="1" />}
            {hover !== null && <circle cx={hx} cy={y(vals[hover])} r="4" fill={INK} stroke={SURFACE} strokeWidth="2" />}
          </svg>
          {hover !== null && (
            <div
              role="status"
              style={{
                position: 'absolute',
                top: 0,
                left: tipLeft,
                width: 140,
                background: '#0b1520',
                border: `1px solid ${GRID}`,
                borderRadius: 8,
                padding: '6px 10px',
                pointerEvents: 'none',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>{format(vals[hover])}</div>
              {avg && <div className="muted">avg {format(avg[hover])}</div>}
              <div className="muted">
                Game {hover + 1}, {day(data[hover].ts)}
              </div>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
