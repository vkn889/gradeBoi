"use client";

import * as React from "react";
import { useGradebook } from "@/components/providers/gradebook-provider";
import { apStore } from "@/lib/client/stores";
import type { ApScoreValue } from "@/lib/client/storage";
import { AP_EXAMS, estimateScore, examById, type ApExam } from "@/lib/ap/exams";
import { COLLEGES, COLLEGES_BY_ID, estimateCredits } from "@/lib/ap/colleges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "@/components/animate-ui/icons/plus";
import { Trash2 } from "@/components/animate-ui/icons/trash-2";
import { CircleCheck } from "@/components/animate-ui/icons/circle-check";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { SectionTitle } from "@/components/app/shared";
import { cn } from "@/lib/utils";

const SCORES: ApScoreValue[] = [1, 2, 3, 4, 5];

const CATEGORIES = Array.from(new Set(AP_EXAMS.map((e) => e.category)));

function examsByCategory() {
  return CATEGORIES.map((cat) => ({ cat, exams: AP_EXAMS.filter((e) => e.category === cat) }));
}

export function ApTools() {
  return (
    <div className="space-y-6 pt-2">
      <div>
        <p className="text-sm text-muted-foreground">Advanced Placement</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AP scores &amp; college credit</h1>
      </div>
      <ScoreCalculator />
      <MyApClasses />
      <CollegeCredit />
    </div>
  );
}

function ScoreColor(score: number) {
  return score >= 4 ? "text-success" : score === 3 ? "text-gold" : "text-danger";
}

function ScoreCalculator() {
  const [examId, setExamId] = React.useState<string>(AP_EXAMS[0].id);
  const exam = examById(examId) as ApExam;
  const [mcq, setMcq] = React.useState("");
  const [frq, setFrq] = React.useState("");

  const mcqN = Number(mcq);
  const frqN = Number(frq);
  const hasInput = mcq.trim() !== "" || frq.trim() !== "";
  const est = estimateScore(exam, {
    mcqCorrect: Number.isFinite(mcqN) ? mcqN : 0,
    frqEarned: Number.isFinite(frqN) ? frqN : 0,
  });

  function changeExam(id: string) {
    setExamId(id);
    setMcq("");
    setFrq("");
  }

  const saveScore = () => apStore.set((s) => ({ ...s, scores: { ...s.scores, [examId]: est.score } }));

  return (
    <section aria-labelledby="calc-title" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <SectionTitle>
          <span id="calc-title">AP score estimator</span>
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a practice or real exam&apos;s raw points to estimate the 1–5. Curves change each year, so treat a result
          near a boundary as a toss-up.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="calc-exam">Exam</Label>
        <Select value={examId} onValueChange={changeExam}>
          <SelectTrigger id="calc-exam" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {examsByCategory().map(({ cat, exams }) => (
              <SelectGroup key={cat}>
                <SelectLabel>{cat}</SelectLabel>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {exam.mcqCount > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="calc-mcq">Multiple-choice correct</Label>
            <div className="flex items-center gap-2">
              <Input
                id="calc-mcq"
                inputMode="numeric"
                className="h-11 text-base tabular"
                value={mcq}
                onChange={(e) => setMcq(e.target.value)}
                placeholder="0"
              />
              <span className="shrink-0 text-sm text-muted-foreground">/ {exam.mcqCount}</span>
            </div>
          </div>
        )}
        {exam.frqMax > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="calc-frq">Free-response points</Label>
            <div className="flex items-center gap-2">
              <Input
                id="calc-frq"
                inputMode="decimal"
                className="h-11 text-base tabular"
                value={frq}
                onChange={(e) => setFrq(e.target.value)}
                placeholder="0"
              />
              <span className="shrink-0 text-sm text-muted-foreground">/ {exam.frqMax}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 p-4" aria-live="polite">
        <div>
          <p className="text-xs text-muted-foreground">Estimated score</p>
          <p className={cn("text-5xl font-semibold tabular", hasInput ? ScoreColor(est.score) : "text-muted-foreground")}>
            {hasInput ? est.score : "—"}
          </p>
        </div>
        {hasInput && (
          <div className="text-right text-sm text-muted-foreground">
            <p className="tabular">{Math.round(est.percent * 100)}% of points (weighted)</p>
            {est.nextScore && est.toNext !== null ? (
              <p className="tabular">
                about {Math.round(est.toNext * 100)}% more for a {est.nextScore}
              </p>
            ) : (
              <p>top score range</p>
            )}
          </div>
        )}
      </div>

      {exam.note && <p className="text-xs text-muted-foreground">{exam.note}</p>}

      {hasInput && (
        <AnimateIcon animateOnHover asChild>
          <Button variant="outline" className="h-10" onClick={saveScore}>
            <CircleCheck size={16} aria-hidden />
            Save {est.score} as my {exam.name} score
          </Button>
        </AnimateIcon>
      )}
    </section>
  );
}

function MyApClasses() {
  const { detectedApExams } = useGradebook();
  const ap = apStore.useValue();

  // Detected from the transcript/classes + any added by hand + any that already have a score.
  const examIds = Array.from(new Set([...detectedApExams, ...ap.manualExams, ...Object.keys(ap.scores)])).filter(
    (id) => examById(id),
  );
  const available = AP_EXAMS.filter((e) => !examIds.includes(e.id));

  const setScore = (id: string, v: string) =>
    apStore.set((s) => {
      const scores = { ...s.scores };
      if (v === "none") delete scores[id];
      else scores[id] = Number(v) as ApScoreValue;
      return { ...s, scores };
    });

  const addExam = (id: string) =>
    apStore.set((s) => (s.manualExams.includes(id) ? s : { ...s, manualExams: [...s.manualExams, id] }));

  const removeExam = (id: string) =>
    apStore.set((s) => {
      const scores = { ...s.scores };
      delete scores[id];
      return { ...s, manualExams: s.manualExams.filter((x) => x !== id), scores };
    });

  return (
    <section aria-labelledby="myap-title" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <SectionTitle>
          <span id="myap-title">My AP exams</span>
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {detectedApExams.length > 0
            ? `Found ${detectedApExams.length} AP ${detectedApExams.length === 1 ? "class" : "classes"} on your transcript and schedule. Set the score you got (or expect) on each.`
            : "Add the AP exams you've taken and the score you got (or expect) on each."}
        </p>
      </div>

      {examIds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No AP exams yet. Add one below.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {examIds.map((id) => {
            const exam = examById(id)!;
            const manual = !detectedApExams.includes(id);
            return (
              <li key={id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{exam.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {exam.category}
                    {manual ? "" : " · from your transcript"}
                  </span>
                </span>
                <Label htmlFor={`score-${id}`} className="sr-only">
                  Score for {exam.name}
                </Label>
                <Select value={ap.scores[id] ? String(ap.scores[id]) : "none"} onValueChange={(v) => setScore(id, v)}>
                  <SelectTrigger id={`score-${id}`} className="h-10 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No score</SelectItem>
                    {SCORES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {manual && (
                  <AnimateIcon animateOnHover asChild>
                    <button
                      type="button"
                      onClick={() => removeExam(id)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-wash hover:text-danger"
                      aria-label={`Remove ${exam.name}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </AnimateIcon>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <Label htmlFor="add-ap">Add an AP exam</Label>
          <Select value="" onValueChange={addExam}>
            <SelectTrigger id="add-ap" className="h-11 w-full">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Plus size={16} aria-hidden /> Add an exam…
              </span>
            </SelectTrigger>
            <SelectContent>
              {examsByCategory()
                .map(({ cat, exams }) => ({ cat, exams: exams.filter((e) => available.includes(e)) }))
                .filter(({ exams }) => exams.length)
                .map(({ cat, exams }) => (
                  <SelectGroup key={cat}>
                    <SelectLabel>{cat}</SelectLabel>
                    {exams.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </section>
  );
}

function CollegeCredit() {
  const ap = apStore.useValue();
  const college = ap.college ? COLLEGES_BY_ID[ap.college] : null;
  const scoredCount = Object.keys(ap.scores).length;
  const est = college ? estimateCredits(college, ap.scores) : null;

  const setCollege = (id: string) => apStore.set((s) => ({ ...s, college: id }));

  return (
    <section aria-labelledby="credit-title" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <SectionTitle>
          <span id="credit-title">College AP credit</span>
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          An estimate of how much credit your AP scores could earn. Policies change yearly and depend on your major, so
          confirm on the college&apos;s official page.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="college">College</Label>
        <Select value={ap.college ?? ""} onValueChange={setCollege}>
          <SelectTrigger id="college" className="h-11 w-full">
            <SelectValue placeholder="Pick a college…" />
          </SelectTrigger>
          <SelectContent>
            {COLLEGES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!college ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Pick a college to see an estimate.
        </p>
      ) : scoredCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Set a score on your AP exams above to estimate credit.
        </p>
      ) : (
        est && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-foreground p-5 text-background">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-gold-soft/25 blur-3xl" />
              <p className="relative text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                Estimated credit at {college.name}
              </p>
              <p className="relative mt-1 text-5xl font-semibold tabular">
                {est.total}
                <span className="ml-2 text-lg font-normal opacity-70">{college.system} credits</span>
              </p>
              {est.capped && (
                <p className="relative mt-1 text-xs opacity-70">
                  Capped at this school&apos;s AP limit ({est.rawTotal} before the cap).
                </p>
              )}
              {college.selective && (
                <p className="relative mt-2 text-xs opacity-80">
                  {college.name} gives little raw AP credit — most scores place you into higher courses instead.
                </p>
              )}
            </div>

            <ul className="divide-y divide-border rounded-xl border border-border">
              {est.perExam.map((row) => {
                const exam = examById(row.examId)!;
                return (
                  <li key={row.examId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{exam.name}</span>
                      <span className="text-xs text-muted-foreground">
                        your score {row.score} · needs {row.min}+{row.note ? ` · ${row.note}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 tabular font-medium",
                        row.eligible ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {row.eligible ? `${row.credits} cr` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-sm">
              <AnimateIcon animateOnHover asChild>
                <a
                  href={college.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 font-medium text-gold underline-offset-4 hover:underline"
                >
                  {college.name}&apos;s official AP policy <ExternalLink size={13} aria-hidden />
                </a>
              </AnimateIcon>
            </p>
            <p className="text-xs text-muted-foreground">{college.note}</p>
          </>
        )
      )}
    </section>
  );
}
