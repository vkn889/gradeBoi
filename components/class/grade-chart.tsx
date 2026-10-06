"use client";

import * as React from "react";
import useMeasure from "react-use-measure";
import { fmtDate, fmtPct } from "@/lib/format";
import type { GradeScale } from "@/lib/grades/scale";

type Point = { date: string; time: number; percent: number };

const H = 220;
const PAD = { top: 16, right: 48, bottom: 28, left: 36 };

/**
 * Running class grade by assignment date. Single series: 2px line, 8px markers,
 * crosshair + tooltip on hover/focus, recessive grid, letter cutoffs as reference lines,
 * and a table view for screen readers.
 */
export function GradeChart({ points, scale }: { points: Point[]; scale: GradeScale }) {
  const [hover, setHover] = React.useState<number | null>(null);
  // Draw at the real pixel width so labels stay 11px on phones instead of scaling down.
  const [measureRef, bounds] = useMeasure();
  const W = Math.max(280, Math.round(bounds.width) || 640);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const titleId = React.useId();

  if (points.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No graded work yet.</p>;
  }

  const values = points.map((p) => p.percent);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5);
  const hi = Math.min(Math.max(100, Math.ceil(Math.max(...values) / 5) * 5), 150);
  const t0 = points[0].time;
  const t1 = points[points.length - 1].time;
  const x = (t: number) => (t1 === t0 ? (PAD.left + W - PAD.right) / 2 : PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.percent).toFixed(1)}`).join(" ");
  const step = hi - lo <= 30 ? 5 : hi - lo <= 60 ? 10 : 25;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const cutoffs = (["A", "B", "C"] as const).map((l) => ({ l, v: scale[l] })).filter((c) => c.v > lo && c.v < hi);

  const nearest = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].time) - px) < Math.abs(x(points[best].time) - px)) best = i;
    }
    return best;
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <figure className="rounded-2xl border border-border bg-card p-4">
      <figcaption id={titleId} className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-medium">Grade over time</span>
        <span className="text-sm tabular text-muted-foreground" aria-live="polite">
          {hp ? `${fmtDate(hp.date)} · ${fmtPct(hp.percent)}` : `Now ${fmtPct(points[points.length - 1].percent)}`}
        </span>
      </figcaption>
      <div className="relative" ref={measureRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y select-none"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerMove={(e) => setHover(nearest(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {cutoffs.map((c) => (
            <g key={c.l}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(c.v)}
                y2={y(c.v)}
                className="stroke-muted-foreground/50"
                strokeDasharray="3 4"
                strokeWidth={1}
              />
              <text x={W - 2} y={y(c.v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
                {c.l} {c.v}%
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-muted-foreground text-[11px]">
            {fmtDate(points[0].date)}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {fmtDate(points[points.length - 1].date)}
          </text>

          <path d={path} fill="none" className="stroke-gold" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hp && (
            <line
              x1={x(hp.time)}
              x2={x(hp.time)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-foreground/40"
              strokeWidth={1}
            />
          )}
          {points.map((p, i) => (
            <circle
              key={p.time}
              cx={x(p.time)}
              cy={y(p.percent)}
              r={hover === i ? 6 : 4}
              className="fill-gold stroke-card"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
      <table className="sr-only">
        <caption>Running class grade by date</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Grade</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.time}>
              <td>{fmtDate(p.date)}</td>
              <td>{fmtPct(p.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
