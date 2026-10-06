"use client";

import * as React from "react";
import type { Assignment, Course } from "@/lib/types";
import { computePercent, finalExamNeeded, solveNeededScore } from "@/lib/grades/engine";
import { distanceToNextLetter, type GradeScale, type Rounding } from "@/lib/grades/scale";
import { fmtNum, fmtPct } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NEW = "__new__";

/** "What do I need?" solver and final exam calculator. */
export function Tools({
  course,
  shownPercent,
  offset,
  scale,
  rounding,
}: {
  course: Course;
  /** grade currently displayed (official or hypothetical) */
  shownPercent: number | null;
  /** displayed minus computed (non-zero only when StudentVUE's math differs) */
  offset: number;
  scale: GradeScale;
  rounding: Rounding;
}) {
  const upcoming = course.assignments.filter((a) => a.score === null && a.possible > 0 && a.status !== "excused" && a.status !== "notForGrading");
  const categories = React.useMemo(
    () => (course.categories.length ? course.categories.map((c) => c.name) : ["General"]),
    [course.categories],
  );

  const defaultTarget = React.useMemo(() => {
    if (shownPercent === null) return scale.A;
    const d = distanceToNextLetter(shownPercent, scale, rounding);
    return d.next ? scale[d.next as keyof GradeScale] : scale.A;
  }, [shownPercent, scale, rounding]);

  const [target, setTarget] = React.useState(String(defaultTarget));
  const [pick, setPick] = React.useState<string>(upcoming[0]?.id ?? NEW);
  const [newPoints, setNewPoints] = React.useState("100");
  const [newCategory, setNewCategory] = React.useState(categories[0]);

  const targetNum = Number(target);
  const validTarget = target.trim() !== "" && Number.isFinite(targetNum) && targetNum >= 0 && targetNum <= 200;
  const pickedId = upcoming.some((a) => a.id === pick) ? pick : NEW;

  const solved = React.useMemo(() => {
    if (!validTarget) return null;
    let c = course;
    let id = pickedId;
    let possible: number;
    if (pickedId === NEW) {
      possible = Number(newPoints);
      if (!Number.isFinite(possible) || possible <= 0) return null;
      id = "__solver__";
      const temp: Assignment = {
        id,
        name: "New assignment",
        category: newCategory ?? categories[0],
        date: new Date().toISOString().slice(0, 10),
        score: null,
        possible,
        status: "ungraded",
      };
      c = { ...course, assignments: [...course.assignments, temp] };
    } else {
      possible = course.assignments.find((a) => a.id === pickedId)?.possible ?? 0;
    }
    // Solve against the computed scale, shifting the target by any official-vs-computed offset.
    const r = solveNeededScore(c, id, targetNum - offset);
    return { r, possible };
  }, [validTarget, course, pickedId, newPoints, newCategory, categories, targetNum, offset]);

  const [current, setCurrent] = React.useState(shownPercent === null ? "" : shownPercent.toFixed(2));
  const [finalTarget, setFinalTarget] = React.useState(String(defaultTarget));
  const [finalWeight, setFinalWeight] = React.useState("20");
  const finalNeeded = finalExamNeeded(Number(current), Number(finalTarget), Number(finalWeight));
  const finalValid =
    current.trim() !== "" && finalTarget.trim() !== "" && finalWeight.trim() !== "" && finalNeeded !== null && Number.isFinite(finalNeeded);

  const computedNow = computePercent(course);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-medium">What do I need?</h3>
        <p className="text-sm text-muted-foreground">Pick a target and an upcoming assignment.</p>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="solver-target">Target grade (%)</Label>
            <Input id="solver-target" inputMode="decimal" className="h-11 text-base tabular" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="solver-assignment">Assignment</Label>
            <Select value={pickedId} onValueChange={setPick}>
              <SelectTrigger id="solver-assignment" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {upcoming.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({fmtNum(a.possible)} pts)
                  </SelectItem>
                ))}
                <SelectItem value={NEW}>A new assignment…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pickedId === NEW && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="solver-points">Points possible</Label>
                <Input id="solver-points" inputMode="decimal" className="h-11 text-base tabular" value={newPoints} onChange={(e) => setNewPoints(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="solver-category">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger id="solver-category" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-xl bg-muted/60 p-4" aria-live="polite">
          {!validTarget || !solved ? (
            <p className="text-sm text-muted-foreground">Enter a target and points possible.</p>
          ) : solved.r === null ? (
            <p className="font-medium">Not reachable with this assignment.</p>
          ) : solved.r.score === 0 ? (
            <p className="font-medium">You&apos;re safe: even a 0 keeps you at {fmtPct(targetNum)} or above.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">You need at least</p>
              <p className="text-3xl font-semibold tabular">
                {fmtNum(solved.r.score)}
                <span className="text-lg font-normal text-muted-foreground"> / {fmtNum(solved.possible)}</span>
              </p>
              <p className="text-sm tabular text-muted-foreground">
                {((solved.r.score / solved.possible) * 100).toFixed(1)}% on it
                {solved.r.score > solved.possible ? " (needs extra credit)" : ""}
              </p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-medium">Final exam calculator</h3>
        <p className="text-sm text-muted-foreground">Score needed on a final to reach your target.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="final-current">Current %</Label>
            <Input id="final-current" inputMode="decimal" className="h-11 text-base tabular" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="final-target">Target %</Label>
            <Input id="final-target" inputMode="decimal" className="h-11 text-base tabular" value={finalTarget} onChange={(e) => setFinalTarget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="final-weight">Final worth %</Label>
            <Input id="final-weight" inputMode="decimal" className="h-11 text-base tabular" value={finalWeight} onChange={(e) => setFinalWeight(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-muted/60 p-4" aria-live="polite">
          {!finalValid ? (
            <p className="text-sm text-muted-foreground">Fill in all three. The final must be worth 1–100% of the grade.</p>
          ) : (finalNeeded as number) <= 0 ? (
            <p className="font-medium">You&apos;ll hit {fmtPct(Number(finalTarget))} even with a 0 on the final.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">You need</p>
              <p className="text-3xl font-semibold tabular">{fmtPct(finalNeeded)}</p>
              <p className="text-sm text-muted-foreground">
                on the final{(finalNeeded as number) > 100 ? ", which would take extra credit" : ""}.
              </p>
            </>
          )}
        </div>
        {computedNow === null && <p className="mt-2 text-xs text-muted-foreground">No graded work yet in this class.</p>}
      </section>
    </div>
  );
}
