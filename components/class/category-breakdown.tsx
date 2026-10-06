"use client";

import * as React from "react";
import type { Course } from "@/lib/types";
import { computeCourse } from "@/lib/grades/engine";
import { fmtNum, fmtPct } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Per-category grades, weights, and which category is pulling the grade down most. */
export function CategoryBreakdown({
  course,
  editable,
  weightsOverridden,
  onWeights,
  onClearWeights,
}: {
  course: Course;
  editable: boolean;
  weightsOverridden: boolean;
  onWeights: (weights: Record<string, number>) => void;
  onClearWeights: () => void;
}) {
  const result = React.useMemo(() => computeCourse(course), [course]);
  const graded = result.categories.filter((c) => c.percent !== null);
  const worst = graded.length > 1 ? [...graded].sort((a, b) => b.pointsLost - a.pointsLost)[0] : null;
  const missingWeights = course.weighted === false && course.categories.length > 1;

  return (
    <div className="space-y-4">
      {worst && worst.pointsLost > 0.05 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pulling your grade down most</p>
          <p className="mt-1 text-lg font-semibold">{worst.name}</p>
          <p className="text-sm text-muted-foreground">
            Costing you <span className="font-medium tabular text-foreground">{worst.pointsLost.toFixed(1)}</span> percentage
            points of your class grade ({fmtPct(worst.percent)} in a category worth {worst.effectiveWeight.toFixed(0)}%).
          </p>
        </div>
      )}

      {!course.weighted && (
        <p className="text-sm text-muted-foreground">
          This class is graded by total points. Categories below are weighted by how many points they hold.
          {missingWeights && !editable && " If your teacher actually weights categories, turn on Hypothetical to enter the weights."}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {!course.weighted && (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
              onClick={() =>
                onWeights(
                  Object.fromEntries(result.categories.map((c) => [c.name, Math.round(c.effectiveWeight)])),
                )
              }
            >
              Enter category weights
            </button>
          )}
          {weightsOverridden && (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-gold hover:underline"
              onClick={onClearWeights}
            >
              Use StudentVUE&apos;s weights
            </button>
          )}
          {course.weighted && (
            <p className="text-xs text-muted-foreground">Edit weights below to try different category weights.</p>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {result.categories.map((c) => (
          <li key={c.name} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs tabular text-muted-foreground">
                  {fmtNum(c.earned)} / {fmtNum(c.possible)} pts
                  {course.weighted
                    ? ` · weight ${c.weight}%${c.percent !== null && Math.abs(c.effectiveWeight - c.weight) > 0.05 ? ` (counts as ${c.effectiveWeight.toFixed(1)}%)` : ""}`
                    : c.possible > 0
                      ? ` · ${c.effectiveWeight.toFixed(1)}% of points`
                      : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editable && course.weighted && (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="sr-only">Weight for {c.name}</span>
                    <Input
                      inputMode="decimal"
                      key={`${c.name}-${weightsOverridden}`}
                      defaultValue={String(c.weight)}
                      className="h-9 w-16 text-center text-base tabular"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100) onWeights({ [c.name]: n });
                      }}
                    />
                    %
                  </label>
                )}
                <span className="text-lg font-semibold tabular">{c.percent === null ? "—" : fmtPct(c.percent)}</span>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full",
                  c.percent === null ? "bg-transparent" : c === worst ? "bg-gold-soft" : "bg-foreground",
                )}
                style={{ width: `${Math.max(0, Math.min(100, c.percent ?? 0))}%` }}
              />
            </div>
            {c.percent === null && <p className="mt-2 text-xs text-muted-foreground">Nothing graded yet, so it doesn&apos;t count.</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
