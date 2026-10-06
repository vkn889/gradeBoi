"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import type { Assignment, Course } from "@/lib/types";
import { countsTowardGrade, pointValue } from "@/lib/grades/engine";
import { fmtDate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssignmentBar } from "./assignment-bar";
import { Trash2 } from "@/components/animate-ui/icons/trash-2";
import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ScenarioOps = {
  editScore: (id: string, score: number | null, possible: number) => void;
  revert: (id: string) => void;
  remove: (id: string) => void;
  restore: (id: string) => void;
  move: (id: string, category: string) => void;
};

type Props = {
  /** course to display (hypothetical copy when hypothetical mode is on) */
  course: Course;
  realCourse: Course;
  hypothetical: boolean;
  removed: Assignment[];
  newIds: Set<string>;
  ops: ScenarioOps;
};

const STATUS_LABEL: Partial<Record<Assignment["status"], { text: string; cls: string }>> = {
  missing: { text: "Missing", cls: "bg-danger-wash text-danger" },
  late: { text: "Late", cls: "bg-warning-wash text-warning" },
  excused: { text: "Excused", cls: "bg-muted text-muted-foreground" },
  notForGrading: { text: "Not for grading", cls: "bg-muted text-muted-foreground" },
  ungraded: { text: "Not graded", cls: "bg-muted text-muted-foreground" },
};

/** Missing and late first, then newest first. */
function sortAssignments(list: Assignment[]): Assignment[] {
  const rank = (a: Assignment) => (a.isHypothetical ? 0 : a.status === "missing" ? 1 : a.status === "late" ? 2 : 3);
  return [...list].sort((x, y) => rank(x) - rank(y) || (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
}

export function AssignmentList({ course, realCourse, hypothetical, removed, newIds, ops }: Props) {
  const list = React.useMemo(() => sortAssignments(course.assignments), [course.assignments]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const categories = React.useMemo(() => {
    const names = course.categories.map((c) => c.name);
    for (const a of realCourse.assignments) if (!names.includes(a.category)) names.push(a.category);
    return names;
  }, [course.categories, realCourse.assignments]);
  const realById = React.useMemo(() => new Map(realCourse.assignments.map((a) => [a.id, a])), [realCourse.assignments]);

  const focusRow = (id: string) => {
    setExpanded(id);
    requestAnimationFrame(() =>
      document.getElementById(`asg-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  };

  if (list.length === 0 && removed.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        No assignments yet{hypothetical ? ". Add one to try a what-if." : "."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hypothetical && (
        <p className="text-xs text-muted-foreground">
          Tap a score to edit it. Swipe left to remove. Changes stay on this device until you reset.
        </p>
      )}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {list.map((a, i) => (
            <AssignmentRow
              key={a.id}
              a={a}
              course={course}
              original={realById.get(a.id)}
              hypothetical={hypothetical}
              isNew={newIds.has(a.id)}
              expanded={expanded === a.id}
              onToggle={() => setExpanded((cur) => (cur === a.id ? null : a.id))}
              bar={
                hypothetical ? (
                  <AssignmentBar
                    index={i}
                    total={list.length}
                    onPrev={() => i > 0 && focusRow(list[i - 1].id)}
                    onNext={() => i < list.length - 1 && focusRow(list[i + 1].id)}
                    canRevert={Boolean(a.isEdited)}
                    onFullCredit={() => ops.editScore(a.id, a.possible, a.possible)}
                    onZero={() => ops.editScore(a.id, 0, a.possible)}
                    onRevert={() => ops.revert(a.id)}
                    onRemove={() => {
                      const next = list[i + 1] ?? list[i - 1];
                      ops.remove(a.id);
                      setExpanded(next ? next.id : null);
                    }}
                    category={a.category}
                    categories={categories}
                    onMove={(c) => ops.move(a.id, c)}
                    assignmentName={a.name}
                  />
                ) : null
              }
              ops={ops}
            />
          ))}
        </AnimatePresence>
      </ul>

      {hypothetical && removed.length > 0 && (
        <section aria-label="Removed assignments" className="rounded-2xl border border-dashed border-border p-3">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Removed ({removed.length})
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {removed.map((a) => (
              <li key={a.id} className="flex min-h-12 items-center gap-3 px-1">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">{a.name}</span>
                <span className="text-sm tabular text-muted-foreground">
                  {a.score === null ? "—" : fmtNum(a.score)}/{fmtNum(a.possible)}
                </span>
                <button
                  type="button"
                  onClick={() => ops.restore(a.id)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gold hover:underline"
                >
                  <RotateCcw size={14} aria-hidden /> Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const SWIPE_REMOVE = -96;

function AssignmentRow({
  a,
  course,
  original,
  hypothetical,
  isNew,
  expanded,
  onToggle,
  bar,
  ops,
}: {
  a: Assignment;
  course: Course;
  original: Assignment | undefined;
  hypothetical: boolean;
  isNew: boolean;
  expanded: boolean;
  onToggle: () => void;
  bar: React.ReactNode;
  ops: ScenarioOps;
}) {
  const reduce = useReducedMotion();
  const pct = a.score !== null && a.possible > 0 ? (a.score / a.possible) * 100 : null;
  const status = a.status === "graded" ? null : STATUS_LABEL[a.status];
  const pv = expanded && countsTowardGrade(a) ? pointValue(course, a.id) : null;
  const changed =
    original && a.isEdited && (original.score !== a.score || original.possible !== a.possible || original.category !== a.category);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < SWIPE_REMOVE) ops.remove(a.id);
  };

  return (
    <motion.li
      id={`asg-${a.id}`}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -60, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {hypothetical && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger-wash pr-5 text-sm font-medium text-danger"
        >
          <Trash2 size={18} className="mr-1.5" /> Remove
        </div>
      )}
      <motion.div
        drag={hypothetical && !expanded ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragDirectionLock
        onDragEnd={onDragEnd}
        className={cn(
          "relative rounded-2xl border bg-card transition-colors",
          expanded ? "border-gold-soft/70" : "border-border",
          a.isHypothetical && "border-dashed border-gold-soft",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`asg-panel-${a.id}`}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {isNew && <span className="size-2 shrink-0 rounded-full bg-gold-soft" aria-label="New grade" role="img" />}
              {a.isHypothetical && <Sparkles size={14} className="shrink-0 text-gold" aria-label="Hypothetical" role="img" />}
              <span className="truncate font-medium">{a.name}</span>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{a.category}</span>
              <span aria-hidden>·</span>
              <span>{fmtDate(a.date)}</span>
              {status && <span className={cn("rounded px-1.5 py-0.5 font-medium", status.cls)}>{status.text}</span>}
              {changed && <span className="rounded bg-gold-wash px-1.5 py-0.5 font-medium text-gold">Edited</span>}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span
              className={cn(
                "block font-semibold tabular",
                hypothetical && "rounded-md underline decoration-dotted decoration-muted-foreground/60 underline-offset-4",
              )}
            >
              {a.score === null ? "—" : fmtNum(a.score)}
              <span className="font-normal text-muted-foreground">/{fmtNum(a.possible)}</span>
            </span>
            <span className="block text-xs tabular text-muted-foreground">
              {pct !== null ? `${pct.toFixed(1)}%` : a.possible === 0 && a.score !== null ? "Extra credit" : " "}
            </span>
            {changed && original && (
              <span className="block text-[0.7rem] tabular text-muted-foreground line-through">
                {original.score === null ? "—" : fmtNum(original.score)}/{fmtNum(original.possible)}
              </span>
            )}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              id={`asg-panel-${a.id}`}
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                {hypothetical && <ScoreEditor a={a} onCommit={(s, p) => ops.editScore(a.id, s, p)} />}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  {a.dueDate && (
                    <div>
                      <dt className="inline">Due </dt>
                      <dd className="inline text-foreground">{fmtDate(a.dueDate)}</dd>
                    </div>
                  )}
                  {pv !== null && (
                    <div>
                      <dt className="inline">1 point = </dt>
                      <dd className="inline font-medium tabular text-foreground">{pv >= 0 ? "+" : ""}{pv.toFixed(2)}%</dd>
                    </div>
                  )}
                  {a.notes && (
                    <div className="col-span-full">
                      <dt className="inline">Notes: </dt>
                      <dd className="inline text-foreground">{a.notes}</dd>
                    </div>
                  )}
                </dl>
                {bar}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}

function ScoreEditor({ a, onCommit }: { a: Assignment; onCommit: (score: number | null, possible: number) => void }) {
  const [score, setScore] = React.useState(a.score === null ? "" : String(a.score));
  const [possible, setPossible] = React.useState(String(a.possible));
  const [synced, setSynced] = React.useState({ score: a.score, possible: a.possible });

  // Keep inputs in sync when the bar changes the score (full credit, zero, revert).
  if (synced.score !== a.score || synced.possible !== a.possible) {
    setSynced({ score: a.score, possible: a.possible });
    setScore(a.score === null ? "" : String(a.score));
    setPossible(String(a.possible));
  }

  const commit = (sText: string, pText: string) => {
    const p = Number(pText);
    if (pText.trim() === "" || !Number.isFinite(p) || p < 0) return;
    if (sText.trim() === "") {
      setSynced({ score: null, possible: p });
      onCommit(null, p);
      return;
    }
    const s = Number(sText);
    if (!Number.isFinite(s) || s < 0) return;
    setSynced({ score: s, possible: p });
    onCommit(s, p);
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor={`score-${a.id}`} className="text-xs">
          Score
        </Label>
        <Input
          id={`score-${a.id}`}
          inputMode="decimal"
          autoFocus
          placeholder="Not graded"
          className="h-11 text-base tabular"
          value={score}
          aria-label={`Score for ${a.name}`}
          onChange={(e) => {
            setScore(e.target.value);
            commit(e.target.value, possible);
          }}
        />
      </div>
      <span className="pb-3 text-muted-foreground" aria-hidden>
        /
      </span>
      <div className="flex-1 space-y-1">
        <Label htmlFor={`possible-${a.id}`} className="text-xs">
          Points possible
        </Label>
        <Input
          id={`possible-${a.id}`}
          inputMode="decimal"
          className="h-11 text-base tabular"
          value={possible}
          aria-label={`Points possible for ${a.name}`}
          onChange={(e) => {
            setPossible(e.target.value);
            commit(score, e.target.value);
          }}
        />
      </div>
    </div>
  );
}
