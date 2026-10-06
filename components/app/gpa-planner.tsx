"use client";

import * as React from "react";
import type { CourseView } from "@/lib/client/course-view";
import { prefsStore, updatePrefs } from "@/lib/client/stores";
import { computeGpa } from "@/lib/grades/gpa";
import { LETTERS, type Letter } from "@/lib/grades/scale";
import { fmtGpa } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LetterBadge } from "@/components/app/shared";
import { cn } from "@/lib/utils";

const ALL: Letter[] = [...LETTERS, "F"];

/** Pick a target letter per class and see the GPA it would produce against a goal. */
export function GpaPlanner({ views }: { views: CourseView[] }) {
  const prefs = prefsStore.useValue();
  const [goalText, setGoalText] = React.useState(prefs.gpaGoal === null ? "" : String(prefs.gpaGoal));
  const graded = views.filter((v) => v.effective.letter !== null);

  const targetFor = (v: CourseView): Letter => {
    const t = prefs.targetLetters[v.course.id];
    return (ALL as string[]).includes(t) ? (t as Letter) : (v.effective.letter as Letter);
  };

  const planned = computeGpa(graded.map((v) => ({ letter: targetFor(v), level: v.course.level })), prefs.bonus);
  const goal = prefs.gpaGoal;
  const meets = goal !== null && planned.weighted !== null && planned.weighted >= goal - 1e-9;
  const meetsU = goal !== null && planned.unweighted !== null && planned.unweighted >= goal - 1e-9;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[auto_1fr] sm:items-end sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="gpa-goal">Goal GPA</Label>
          <Input
            id="gpa-goal"
            inputMode="decimal"
            placeholder="3.80"
            className="h-11 w-32 text-base tabular"
            value={goalText}
            onChange={(e) => {
              setGoalText(e.target.value);
              const n = Number(e.target.value);
              updatePrefs({ gpaGoal: e.target.value.trim() && Number.isFinite(n) && n >= 0 && n <= 5 ? n : null });
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Planned weighted</p>
            <p className={cn("text-2xl font-semibold tabular", goal !== null && (meets ? "text-success" : "text-danger"))}>
              {fmtGpa(planned.weighted)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Planned unweighted</p>
            <p className={cn("text-2xl font-semibold tabular", goal !== null && (meetsU ? "text-success" : "text-danger"))}>
              {fmtGpa(planned.unweighted)}
            </p>
          </div>
        </div>
        {goal !== null && (
          <p className="text-sm text-muted-foreground sm:col-span-2" aria-live="polite">
            {meets
              ? `This plan reaches a ${goal.toFixed(2)} weighted GPA.`
              : `This plan is ${(goal - (planned.weighted ?? 0)).toFixed(2)} short of ${goal.toFixed(2)} weighted. Raise a target below.`}
          </p>
        )}
      </div>

      {graded.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">No graded classes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {graded.map((v) => (
            <li key={v.course.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{v.course.title}</span>
                <span className="text-xs text-muted-foreground">
                  Now <LetterBadge letter={v.effective.letter} size="sm" className="ml-1" />
                </span>
              </span>
              <Label htmlFor={`target-${v.course.id}`} className="sr-only">
                Target for {v.course.title}
              </Label>
              <Select
                value={targetFor(v)}
                onValueChange={(val) => updatePrefs({ targetLetters: { ...prefs.targetLetters, [v.course.id]: val } })}
              >
                <SelectTrigger id={`target-${v.course.id}`} className="h-10 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
