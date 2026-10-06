"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useGradebook } from "@/components/providers/gradebook-provider";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeltaText, ErrorState, LetterBadge, SectionTitle } from "@/components/app/shared";
import dynamic from "next/dynamic";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { ClipboardList } from "@/components/animate-ui/icons/clipboard-list";
import { RefreshCw } from "@/components/animate-ui/icons/refresh-cw";
import { prefsStore } from "@/lib/client/stores";
import { courseSlug, fmtDate, fmtGpa, fmtPct, teacherName } from "@/lib/format";
import { distanceToNextLetter } from "@/lib/grades/scale";
import type { CourseView } from "@/lib/client/course-view";
import { cn } from "@/lib/utils";

// Secondary tabs load on demand to keep the first paint light.
const Upcoming = dynamic(() => import("@/components/app/upcoming").then((m) => m.Upcoming));
const GpaPlanner = dynamic(() => import("@/components/app/gpa-planner").then((m) => m.GpaPlanner));

export function Dashboard() {
  const { status, error, load, views, gradebook, period, studentName, demo, refreshing } = useGradebook();

  if (status === "loading") return <DashboardSkeleton />;
  if (status === "error" || !gradebook) {
    return <ErrorState message={error?.message ?? "Something went wrong."} onRetry={() => void load(period ?? undefined)} />;
  }

  const periodName = gradebook.reportPeriods.find((p) => p.index === period)?.name;
  const firstName = studentName.split(/[\s,]+/)[0] || "there";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {periodName ?? "Grades"}
            {period !== gradebook.currentPeriod && " · past period"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi, {firstName}</h1>
        </div>
        {demo && (
          <Badge variant="outline" className="h-7 border-gold-soft/60 bg-gold-wash px-2.5 text-gold">
            Demo data
          </Badge>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-wash px-4 py-3 text-sm text-danger">
          <span>{error.message}</span>
          <button
            type="button"
            onClick={() => void load(period ?? undefined)}
            disabled={refreshing}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-medium underline underline-offset-4"
          >
            <RefreshCw size={14} aria-hidden /> Retry
          </button>
        </div>
      )}

      <GpaCard />
      <NeedsAttention views={views} />

      <Tabs defaultValue="classes">
        <TabsList className="h-11 w-full sm:w-fit">
          <TabsTrigger value="classes" className="px-4">Classes</TabsTrigger>
          <TabsTrigger value="upcoming" className="px-4">Upcoming</TabsTrigger>
          <TabsTrigger value="planner" className="px-4">GPA goal</TabsTrigger>
        </TabsList>
        <TabsContents className="mt-3">
          <TabsContent value="classes" className="p-0.5">
            {views.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                No classes in this grading period.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {views.map((v, i) => (
                  <ClassRow key={v.course.id} view={v} index={i} />
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="upcoming" className="p-0.5">
            <Upcoming views={views} />
          </TabsContent>
          <TabsContent value="planner" className="p-0.5">
            <GpaPlanner views={views} />
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
  );
}

function GpaCard() {
  const { gpa, realGpa, cumulative, realCumulative, anyHypothetical, transcript } = useGradebook();
  const prefs = prefsStore.useValue();
  const reading = prefs.gpaSource === "auto" && transcript.status === "LOADING";
  const sourceText =
    cumulative.source === "transcript" && transcript.status === "FOUND"
      ? `Unofficial transcript (${fmtDate(transcript.transcript.document.date)})${cumulative.currentIncluded ? " + this term" : ""}`
      : reading
        ? "Reading your transcript…"
        : cumulative.source === "manual"
          ? "Past years you entered + this term"
          : "This term only so far";

  return (
    <section
      aria-label="GPA"
      className="relative overflow-hidden rounded-2xl bg-foreground p-5 text-background shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)] sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-gold-soft/25 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
          Cumulative GPA
          {anyHypothetical && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[0.7rem] normal-case tracking-normal text-black">
              <Sparkles size={12} aria-hidden /> Hypothetical
            </span>
          )}
        </div>
        <p className="text-xs opacity-70" aria-live="polite">
          {sourceText}
          {cumulative.credits > 0 && cumulative.source !== "term" ? ` · ${fmtCredits(cumulative.credits)} credits` : ""}
        </p>
      </div>
      {/* Many districts (Northshore included) only report an unweighted GPA; show one number then. */}
      {cumulative.weighted === null ? (
        <dl className="relative mt-4">
          <dt className="text-sm opacity-70">Unweighted (4.0 scale)</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight tabular sm:text-7xl">{fmtGpa(cumulative.unweighted)}</span>
            {anyHypothetical && cumulative.unweighted !== null && realCumulative.unweighted !== null && (
              <GpaDelta now={cumulative.unweighted} was={realCumulative.unweighted} />
            )}
          </dd>
        </dl>
      ) : (
        <dl className="relative mt-4 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm opacity-70">Weighted</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight tabular sm:text-6xl">{fmtGpa(cumulative.weighted)}</span>
              {anyHypothetical && cumulative.weighted !== null && realCumulative.weighted !== null && (
                <GpaDelta now={cumulative.weighted} was={realCumulative.weighted} />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm opacity-70">Unweighted</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight tabular sm:text-6xl">{fmtGpa(cumulative.unweighted)}</span>
              {anyHypothetical && cumulative.unweighted !== null && realCumulative.unweighted !== null && (
                <GpaDelta now={cumulative.unweighted} was={realCumulative.unweighted} />
              )}
            </dd>
          </div>
        </dl>
      )}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-background/15 pt-3 text-xs">
        <p className="opacity-80">
          This term:{" "}
          {gpa.weighted !== null && gpa.weighted !== gpa.unweighted ? (
            <>
              <span className="font-semibold tabular">{fmtGpa(gpa.weighted)}</span> weighted ·{" "}
              <span className="font-semibold tabular">{fmtGpa(gpa.unweighted)}</span> unweighted
            </>
          ) : (
            <>
              <span className="font-semibold tabular">{fmtGpa(gpa.unweighted)}</span> unweighted
            </>
          )}
          {anyHypothetical && ` (real ${fmtGpa(realGpa.unweighted)})`}
        </p>
        <Link
          href="/gpa"
          className="inline-flex min-h-11 items-center rounded-full bg-background/10 px-3 font-medium transition-colors hover:bg-background/20"
        >
          {cumulative.source === "transcript" ? "How it's calculated" : reading ? "GPA details" : "Add past years"}
        </Link>
      </div>
    </section>
  );
}

function fmtCredits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function GpaDelta({ now, was }: { now: number; was: number }) {
  const d = Number((now - was).toFixed(2));
  if (d === 0) return null;
  return (
    <span className={cn("text-sm font-medium tabular", d > 0 ? "text-[#7bc4a0] dark:text-[#2f6b4f]" : "text-[#f0a3a3] dark:text-[#a23b3b]")}>
      {d > 0 ? "+" : "−"}
      {Math.abs(d).toFixed(2)}
    </span>
  );
}

function NeedsAttention({ views }: { views: CourseView[] }) {
  const items = views.flatMap((v) =>
    [...v.missing, ...v.late].map((a) => ({ view: v, a })),
  );
  const newCount = views.reduce((t, v) => t + v.newIds.size, 0);
  if (items.length === 0 && newCount === 0) return null;

  return (
    <section aria-labelledby="attention-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>
          <span id="attention-title" className="inline-flex items-center gap-2">
            <ClipboardList size={14} aria-hidden /> Needs attention
          </span>
        </SectionTitle>
        {newCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gold">
            <span className="size-2 rounded-full bg-gold-soft" aria-hidden />
            {newCount} new {newCount === 1 ? "grade" : "grades"}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {items.slice(0, 8).map(({ view, a }) => (
            <li key={view.course.id + a.id}>
              <Link
                href={`/class/${courseSlug(view.course.id)}`}
                className="flex min-h-12 items-center gap-3 py-2 transition-colors hover:text-foreground"
              >
                <span
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-semibold",
                    a.status === "missing" ? "bg-danger-wash text-danger" : "bg-warning-wash text-warning",
                  )}
                >
                  {a.status === "missing" ? "Missing" : "Late"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {view.course.title} · {fmtDate(a.dueDate ?? a.date)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular text-muted-foreground">
                  {a.score === null ? "—" : a.score}/{a.possible}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 8 && <p className="mt-2 text-xs text-muted-foreground">+{items.length - 8} more in your classes</p>}
    </section>
  );
}

function ClassRow({ view, index }: { view: CourseView; index: number }) {
  const prefs = prefsStore.useValue();
  const reduce = useReducedMotion();
  const { course, real, hypo, delta, hypoEnabled } = view;
  const shown = hypo ?? real;
  const dist = shown.percent !== null ? distanceToNextLetter(shown.percent, prefs.scale, prefs.rounding) : null;

  return (
    <motion.li
      className="min-w-0"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Link
        href={`/class/${courseSlug(course.id)}`}
        className="group flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-gold-soft/70"
        aria-label={`${course.title}, ${shown.percent === null ? "no grade yet" : `${fmtPct(shown.percent)} ${shown.letter ?? ""}`}`}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular text-muted-foreground">
          {course.period}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="line-clamp-2 font-medium leading-snug">{course.title}</span>
            {course.level !== "regular" && (
              <span className="mt-0.5 shrink-0 rounded border border-border px-1 text-[0.65rem] font-semibold uppercase text-muted-foreground">
                {course.level === "ap" ? "AP" : "H"}
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-muted-foreground">{teacherName(course.teacher)}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {view.newIds.size > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-gold-wash px-1.5 py-0.5 text-xs font-medium text-gold">
                <span className="size-1.5 rounded-full bg-gold-soft" aria-hidden />
                {view.newIds.size} new
              </span>
            )}
            {view.missing.length > 0 && (
              <span className="rounded-md bg-danger-wash px-1.5 py-0.5 text-xs font-medium text-danger">
                {view.missing.length} missing
              </span>
            )}
            {view.late.length > 0 && (
              <span className="rounded-md bg-warning-wash px-1.5 py-0.5 text-xs font-medium text-warning">{view.late.length} late</span>
            )}
            {dist && dist.next && dist.toNext !== null && dist.toNext <= 3 && (
              <span className="text-xs text-muted-foreground">
                {dist.toNext.toFixed(1)}% from {article(dist.next)} {dist.next}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-2">
            <span className={cn("text-lg font-semibold tabular", shown.percent === null && "text-muted-foreground")}>
              {shown.percent === null ? "No grade" : fmtPct(shown.percent)}
            </span>
            <LetterBadge letter={shown.letter} />
          </span>
          {hypoEnabled && hypo && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles size={12} className="text-gold" aria-hidden />
              <span className="tabular">was {fmtPct(real.percent)}</span>
              <DeltaText delta={delta} />
            </span>
          )}
        </span>
      </Link>
    </motion.li>
  );
}

export function article(letter: string) {
  return /^[AEF]/.test(letter) ? "an" : "a";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pt-2" aria-busy="true" aria-label="Loading grades">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
