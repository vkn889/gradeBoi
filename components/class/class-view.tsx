"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useCourseScenario, useGradebook, useScenarioNames } from "@/components/providers/gradebook-provider";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { ArrowLeft } from "@/components/animate-ui/icons/arrow-left";
import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeltaText, ErrorState, LetterBadge } from "@/components/app/shared";
import { article } from "@/components/app/dashboard";
import { AssignmentList, type ScenarioOps } from "./assignment-list";
import dynamic from "next/dynamic";
import { AddAssignmentDialog } from "./add-assignment-dialog";
import { ScenarioMenu } from "./scenario-menu";
import { prefsStore, updatePrefs } from "@/lib/client/stores";
import { fmtPct, teacherName } from "@/lib/format";
import { distanceToNextLetter } from "@/lib/grades/scale";
import { detectLevel } from "@/lib/grades/gpa";
import {
  addAssignment,
  changeCategory,
  clearWeights,
  editScore,
  isEmptyScenario,
  removeAssignment,
  restoreAssignment,
  revertEdit,
  setWeights,
} from "@/lib/grades/hypothetical";
import type { CourseLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

// Secondary tabs load on demand to keep the first paint light.
const CategoryBreakdown = dynamic(() => import("./category-breakdown").then((m) => m.CategoryBreakdown));
const Insights = dynamic(() => import("./insights").then((m) => m.Insights));
const Tools = dynamic(() => import("./tools").then((m) => m.Tools));

export function ClassView({ courseId }: { courseId: string }) {
  const { status, error, load, views, period, markSeen } = useGradebook();
  const prefs = prefsStore.useValue();
  const view = views.find((v) => v.course.id === courseId);
  const scenario = useCourseScenario(view);
  const scenarioNames = useScenarioNames(view?.key);

  // Snapshot "new" ids on first render so highlights stay visible during this visit, then mark seen.
  const [newIds, setNewIds] = React.useState<Set<string> | null>(null);
  if (view && newIds === null) setNewIds(new Set(view.newIds));
  const viewId = view?.course.id;
  React.useEffect(() => {
    if (viewId) markSeen(viewId);
  }, [viewId, markSeen]);

  // SRD: log mismatches between computed and official grades for debugging (no PII).
  const mismatchMsg = view?.real.mismatch
    ? `[gradeboi] grade mismatch: period ${view.course.period}, computed ${view.real.computed?.toFixed(2)} vs official ${view.course.official.percent}`
    : null;
  React.useEffect(() => {
    if (mismatchMsg) console.warn(mismatchMsg);
  }, [mismatchMsg]);

  if (status === "loading") return <ClassSkeleton />;
  if (status === "error") return <ErrorState message={error?.message ?? "Something went wrong."} onRetry={() => void load(period ?? undefined)} />;
  if (!view) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className="text-lg font-semibold">Class not found</p>
        <p className="mt-2 text-sm text-muted-foreground">It may not be in this grading period.</p>
        <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { course, real, hypo, delta, hypoEnabled, applied } = view;
  const shownCourse = hypoEnabled && applied ? applied.course : course;
  const shown = hypo ?? real;
  const dist = shown.percent !== null ? distanceToNextLetter(shown.percent, prefs.scale, prefs.rounding) : null;
  const categories = Array.from(new Set([...course.categories.map((c) => c.name), ...course.assignments.map((a) => a.category)]));
  const editedCount =
    Object.keys(view.scenario.edits).length +
    Object.keys(view.scenario.categoryChanges).length +
    view.scenario.removed.length +
    view.scenario.added.length;
  const offset = real.mismatch && real.computed !== null && real.percent !== null ? real.percent - real.computed : 0;

  const ops: ScenarioOps = {
    editScore: (id, s, p) => scenario.edit((sc) => editScore(sc, id, s, p)),
    revert: (id) => scenario.edit((sc) => revertEdit(sc, id)),
    remove: (id) => {
      scenario.edit((sc) => removeAssignment(sc, id));
      if (!id.startsWith("h-")) {
        toast("Assignment removed", {
          action: { label: "Undo", onClick: () => scenario.edit((sc) => restoreAssignment(sc, id)) },
        });
      }
    },
    restore: (id) => scenario.edit((sc) => restoreAssignment(sc, id)),
    move: (id, c) => scenario.edit((sc) => changeCategory(sc, id, c)),
  };

  const autoLevel = detectLevel(course.title);
  const setLevel = (lvl: CourseLevel) => {
    const next = { ...prefs.levelOverrides };
    if (lvl === autoLevel) delete next[course.id];
    else next[course.id] = lvl;
    updatePrefs({ levelOverrides: next });
  };

  return (
    <div className="space-y-5">
      <AnimateIcon animateOnHover asChild>
        <Link href="/dashboard" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden /> All classes
        </Link>
      </AnimateIcon>

      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Period {course.period}
          {course.room ? ` · Room ${course.room}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{course.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-sm text-muted-foreground">
          <span>{teacherName(course.teacher)}</span>
          {course.teacherEmail && (
            <AnimateIcon animateOnHover asChild>
              <a
                href={`mailto:${course.teacherEmail}?subject=${encodeURIComponent(course.title)}`}
                className="inline-flex min-h-11 items-center gap-1 font-medium text-gold underline-offset-4 hover:underline"
              >
                Email teacher <ExternalLink size={13} aria-hidden />
              </a>
            </AnimateIcon>
          )}
          <span className="inline-flex items-center gap-2">
            <Label htmlFor="level" className="text-sm font-normal text-muted-foreground">
              Level
            </Label>
            <Select value={course.level} onValueChange={(v) => setLevel(v as CourseLevel)}>
              <SelectTrigger id="level" className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular{autoLevel === "regular" ? " (auto)" : ""}</SelectItem>
                <SelectItem value="honors">Honors{autoLevel === "honors" ? " (auto)" : ""}</SelectItem>
                <SelectItem value="ap">AP{autoLevel === "ap" ? " (auto)" : ""}</SelectItem>
              </SelectContent>
            </Select>
          </span>
        </div>
      </header>

      <section aria-label="Class grade" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        {hypoEnabled ? (
          <dl className="grid grid-cols-3 gap-3 text-center sm:text-left">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Real</dt>
              <dd className="mt-1 flex flex-col items-center gap-1.5 sm:flex-row sm:items-baseline">
                <span className="text-2xl font-semibold tabular sm:text-3xl">{fmtPct(real.percent)}</span>
                <LetterBadge letter={real.letter} size="sm" />
              </dd>
            </div>
            <div>
              <dt className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                <Sparkles size={12} aria-hidden /> What-if
              </dt>
              <dd className="mt-1 flex flex-col items-center gap-1.5 sm:flex-row sm:items-baseline">
                <span className="text-2xl font-semibold tabular sm:text-3xl">{fmtPct(hypo?.percent ?? null)}</span>
                <LetterBadge letter={hypo?.letter ?? null} size="sm" />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Change</dt>
              <dd className="mt-1 text-2xl sm:text-3xl">
                {delta === null ? <span className="text-muted-foreground">—</span> : <DeltaText delta={delta} />}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-5xl font-semibold tracking-tight tabular">{fmtPct(real.percent)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.weighted ? "Weighted by category" : "Total points"}
              </p>
            </div>
            <LetterBadge letter={real.letter} size="lg" />
          </div>
        )}

        {dist && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            {dist.next && dist.toNext !== null && (
              <>
                <span className="font-medium tabular text-foreground">{dist.toNext.toFixed(1)}%</span> from {article(dist.next)}{" "}
                {dist.next}
              </>
            )}
            {dist.next && dist.aboveCurrent !== null && " · "}
            {dist.aboveCurrent !== null && (
              <>
                <span className="font-medium tabular text-foreground">{dist.aboveCurrent.toFixed(1)}%</span> above the {dist.current}{" "}
                cutoff
              </>
            )}
          </p>
        )}
        {real.mismatch && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing StudentVUE&apos;s official {fmtPct(real.percent)}. GradeBoi&apos;s math gives {fmtPct(real.computed)}, so your
            teacher may use a setting StudentVUE doesn&apos;t share. What-if changes are applied on top of the official grade.
          </p>
        )}
      </section>

      <section
        aria-label="Hypothetical mode"
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition-colors",
          hypoEnabled ? "border-gold-soft/70 bg-gold-wash/60" : "border-border bg-card",
        )}
      >
        <div className="flex min-h-11 items-center gap-3 pl-1">
          <Switch id="hypo" checked={hypoEnabled} onCheckedChange={scenario.setEnabled} />
          <Label htmlFor="hypo" className="flex flex-col items-start gap-0">
            <span className="font-medium">Hypothetical</span>
            <span className="text-xs font-normal text-muted-foreground">
              {hypoEnabled ? `${editedCount} ${editedCount === 1 ? "change" : "changes"}` : "Try scores without touching real data"}
            </span>
          </Label>
        </div>
        {hypoEnabled && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <ScenarioMenu
              names={scenarioNames}
              active={view.scenarioName}
              onSelect={scenario.select}
              onSaveAs={scenario.saveAs}
              onNew={scenario.createBlank}
              onDelete={scenario.removeScenario}
            />
            <AddAssignmentDialog
              categories={categories}
              onAdd={(input) => scenario.edit((sc) => addAssignment(sc, input))}
            />
            <AnimateIcon animateOnHover asChild>
              <Button
                variant="ghost"
                className="h-11 px-3"
                onClick={() => {
                  scenario.reset();
                  toast.success("Back to your real grades.");
                }}
                disabled={isEmptyScenario(view.scenario)}
              >
                <RotateCcw size={16} aria-hidden />
                Reset
              </Button>
            </AnimateIcon>
          </div>
        )}
      </section>

      <Tabs defaultValue="assignments">
        <TabsList className="h-11 w-full">
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>
        <TabsContents className="mt-3">
          <TabsContent value="assignments" className="p-0.5">
            <AssignmentList
              course={shownCourse}
              realCourse={course}
              hypothetical={hypoEnabled}
              removed={applied?.removed ?? []}
              newIds={newIds ?? view.newIds}
              ops={ops}
            />
          </TabsContent>
          <TabsContent value="categories" className="p-0.5">
            <CategoryBreakdown
              course={shownCourse}
              editable={hypoEnabled}
              weightsOverridden={Object.keys(view.scenario.weights ?? {}).length > 0}
              onWeights={(w) => scenario.edit((sc) => setWeights(sc, w))}
              onClearWeights={() => scenario.edit((sc) => clearWeights(sc))}
            />
          </TabsContent>
          <TabsContent value="insights" className="p-0.5">
            <Insights course={shownCourse} />
          </TabsContent>
          <TabsContent value="tools" className="p-0.5">
            <Tools
              key={`${course.id}-${hypoEnabled}`}
              course={shownCourse}
              shownPercent={shown.percent}
              offset={offset}
              scale={prefs.scale}
              rounding={prefs.rounding}
            />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}

function ClassSkeleton() {
  return (
    <div className="space-y-5 pt-2" aria-busy="true" aria-label="Loading class">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}
