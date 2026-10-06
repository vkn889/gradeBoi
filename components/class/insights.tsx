"use client";

import * as React from "react";
import type { Course } from "@/lib/types";
import { assignmentImpacts, gradeHistory, pointValue } from "@/lib/grades/engine";
import { fmtNum } from "@/lib/format";
import { prefsStore } from "@/lib/client/stores";
import { GradeChart } from "./grade-chart";
import { cn } from "@/lib/utils";

export function Insights({ course }: { course: Course }) {
  const prefs = prefsStore.useValue();
  const history = React.useMemo(() => gradeHistory(course), [course]);
  const impacts = React.useMemo(() => assignmentImpacts(course), [course]);
  const helped = impacts.filter((i) => i.impact > 0.005).slice(0, 4);
  const hurt = impacts.filter((i) => i.impact < -0.005).sort((a, b) => a.impact - b.impact).slice(0, 4);

  const values = React.useMemo(
    () =>
      course.assignments
        .filter((a) => a.score !== null && a.possible > 0)
        .map((a) => ({ a, v: pointValue(course, a.id) }))
        .filter((x): x is { a: (typeof x)["a"]; v: number } => x.v !== null)
        .sort((x, y) => y.v - x.v)
        .slice(0, 5),
    [course],
  );

  return (
    <div className="space-y-4">
      <GradeChart points={history} scale={prefs.scale} />

      <div className="grid gap-4 md:grid-cols-2">
        <ImpactList title="Helped the most" items={helped} positive />
        <ImpactList title="Hurt the most" items={hurt} positive={false} />
      </div>

      {values.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-medium">What one point is worth</h3>
          <p className="text-sm text-muted-foreground">One more point on these moves your class grade the most.</p>
          <ul className="mt-3 divide-y divide-border">
            {values.map(({ a, v }) => (
              <li key={a.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {a.name} <span className="text-muted-foreground">· {a.category}</span>
                </span>
                <span className="shrink-0 font-medium tabular">+{v.toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ImpactList({
  title,
  items,
  positive,
}: {
  title: string;
  items: { assignment: { id: string; name: string; score: number | null; possible: number }; impact: number }[];
  positive: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map(({ assignment, impact }) => (
            <li key={assignment.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{assignment.name}</span>
                <span className="text-xs tabular text-muted-foreground">
                  {fmtNum(assignment.score)}/{fmtNum(assignment.possible)}
                </span>
              </span>
              <span className={cn("shrink-0 font-medium tabular", positive ? "text-success" : "text-danger")}>
                {impact > 0 ? "+" : "−"}
                {Math.abs(impact).toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
