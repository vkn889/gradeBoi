"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useGradebook } from "@/components/providers/gradebook-provider";
import { historyStore, prefsStore, updatePrefs } from "@/lib/client/stores";
import type { GradeLevel, PastCourse } from "@/lib/client/storage";
import { computeGpa, detectLevel } from "@/lib/grades/gpa";
import { LETTERS, type Letter } from "@/lib/grades/scale";
import { fmtGpa } from "@/lib/format";
import type { CourseLevel } from "@/lib/types";
import { Plus } from "@/components/animate-ui/icons/plus";
import { Trash2 } from "@/components/animate-ui/icons/trash-2";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { LoaderCircle } from "@/components/animate-ui/icons/loader-circle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionTitle } from "@/components/app/shared";

const ALL_LETTERS: Letter[] = [...LETTERS, "F"];
const GRADE_LEVELS: GradeLevel[] = [9, 10, 11, 12];
const TERMS: PastCourse["term"][] = ["S1", "S2", "Year"];
const CREDIT_OPTIONS = ["0.25", "0.5", "1"];
const LEVEL_LABEL: Record<CourseLevel, string> = { regular: "Regular", honors: "Honors", ap: "AP" };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

/** Cumulative GPA across all of high school: past years (entered here) plus this term. */
export function PastYears() {
  const { cumulative, gpa, views, transcript } = useGradebook();
  const usingTranscript = cumulative.source === "transcript";
  const history = historyStore.useValue();
  const prefs = prefsStore.useValue();

  const byYear = GRADE_LEVELS.map((g) => {
    const list = history.filter((h) => h.gradeLevel === g);
    return { grade: g, list, gpa: computeGpa(list, prefs.bonus) };
  });
  const gradedThisTerm = views.filter((v) => v.effective.letter !== null).length;

  const update = (id: string, patch: Partial<PastCourse>) =>
    historyStore.set((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const remove = (id: string) => {
    const removed = history.find((h) => h.id === id);
    historyStore.set((prev) => prev.filter((h) => h.id !== id));
    if (removed) {
      toast(`Removed ${removed.name}`, {
        action: { label: "Undo", onClick: () => historyStore.set((prev) => [...prev, removed]) },
      });
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div>
        <p className="text-sm text-muted-foreground">All of high school</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cumulative GPA</h1>
      </div>

      <section aria-label="Cumulative GPA" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cumulative weighted" value={fmtGpa(cumulative.weighted)} strong />
        <Stat label="Cumulative unweighted" value={fmtGpa(cumulative.unweighted)} strong />
        <Stat label="This term weighted" value={fmtGpa(gpa.weighted)} />
        <Stat label="Credits counted" value={String(Math.round(cumulative.credits * 100) / 100)} />
      </section>

      <TranscriptPanel />

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="include-current" className="flex flex-col items-start gap-0.5">
            <span>Include this grading period</span>
            <span className="text-xs font-normal text-muted-foreground">
              {gradedThisTerm} {gradedThisTerm === 1 ? "class" : "classes"} with a grade. Classes at 0.0% (no grade yet) never count.
            </span>
          </Label>
          <Switch id="include-current" checked={prefs.includeCurrent} onCheckedChange={(v) => updatePrefs({ includeCurrent: v })} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="current-credits" className="flex flex-col items-start gap-0.5">
            <span>Each current class counts as</span>
            <span className="text-xs font-normal text-muted-foreground">A semester class is usually 0.5 credits.</span>
          </Label>
          <Select value={String(prefs.currentCredits)} onValueChange={(v) => updatePrefs({ currentCredits: Number(v) })}>
            <SelectTrigger id="current-credits" className="h-10 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c} credit{c === "1" ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {usingTranscript ? (
        <p className="text-sm text-muted-foreground">
          Past years come from your transcript automatically.{" "}
          {history.length > 0 && `The ${history.length} class${history.length === 1 ? "" : "es"} you entered by hand aren't used while the transcript is on. `}
          Turn off &quot;Use my transcript&quot; above to enter classes yourself.
        </p>
      ) : (
        <>
          <AddPastCourse />
          <p className="text-sm text-muted-foreground">
            Enter past classes from your transcript (in{" "}
            <Link href="/documents" className="font-medium text-foreground underline underline-offset-4">
              Documents
            </Link>
            ). They&apos;re saved on this device only.
          </p>
        </>
      )}

      {!usingTranscript &&
        byYear.map(({ grade, list, gpa: yearGpa }) =>
        list.length === 0 ? null : (
          <section key={grade} aria-labelledby={`grade-${grade}`} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>
                <span id={`grade-${grade}`}>Grade {grade}</span>
              </SectionTitle>
              <span className="text-sm tabular text-muted-foreground">
                {fmtGpa(yearGpa.weighted)} weighted · {fmtGpa(yearGpa.unweighted)} unweighted
              </span>
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {list.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.term === "Year" ? "Full year" : h.term} · {h.credits} cr · {LEVEL_LABEL[h.level]}
                    </span>
                  </span>
                  <Select value={h.letter} onValueChange={(v) => update(h.id, { letter: v as Letter })}>
                    <SelectTrigger className="h-10 w-20" aria-label={`Grade for ${h.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_LETTERS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AnimateIcon animateOnHover asChild>
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-wash hover:text-danger"
                      aria-label={`Remove ${h.name}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </AnimateIcon>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      {!usingTranscript && history.length === 0 && transcript.status !== "LOADING" && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No past grades yet. Right now your GPA is just this term.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-foreground p-4 text-background" : "rounded-2xl border border-border bg-card p-4"}>
      <p className={strong ? "text-xs opacity-70" : "text-xs text-muted-foreground"}>{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{value}</p>
    </div>
  );
}

function AddPastCourse() {
  const [gradeLevel, setGradeLevel] = React.useState<GradeLevel>(9);
  const [term, setTerm] = React.useState<PastCourse["term"]>("S1");
  const [name, setName] = React.useState("");
  const [letter, setLetter] = React.useState<Letter>("A");
  const [level, setLevel] = React.useState<CourseLevel | null>(null);
  const [credits, setCredits] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);

  const effectiveLevel = level ?? detectLevel(name);
  const effectiveCredits = credits ?? (term === "Year" ? "1" : "0.5");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter the class name.");
      nameRef.current?.focus();
      return;
    }
    historyStore.set((prev) => [
      ...prev,
      {
        id: newId(),
        gradeLevel,
        term,
        name: name.trim().slice(0, 80),
        letter,
        level: effectiveLevel,
        credits: Number(effectiveCredits),
      },
    ]);
    // Keep year/term/letter for fast entry of the next class from the same transcript row.
    setName("");
    setLevel(null);
    setError(null);
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Add a past class">
      <h2 className="font-medium">Add a past class</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Grade" id="past-grade">
          <Select value={String(gradeLevel)} onValueChange={(v) => setGradeLevel(Number(v) as GradeLevel)}>
            <SelectTrigger id="past-grade" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADE_LEVELS.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}th grade
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Term" id="past-term">
          <Select value={term} onValueChange={(v) => setTerm(v as PastCourse["term"])}>
            <SelectTrigger id="past-term" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "Year" ? "Full year" : t === "S1" ? "Semester 1" : "Semester 2"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label htmlFor="past-name">Class</Label>
          <Input
            ref={nameRef}
            id="past-name"
            className="h-11 text-base"
            placeholder="Honors Biology"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "past-name-error" : undefined}
          />
        </div>
        <Field label="Letter" id="past-letter">
          <Select value={letter} onValueChange={(v) => setLetter(v as Letter)}>
            <SelectTrigger id="past-letter" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_LETTERS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Level" id="past-level">
          <Select value={effectiveLevel} onValueChange={(v) => setLevel(v as CourseLevel)}>
            <SelectTrigger id="past-level" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LEVEL_LABEL) as CourseLevel[]).map((l) => (
                <SelectItem key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Credits" id="past-credits">
          <Select value={effectiveCredits} onValueChange={setCredits}>
            <SelectTrigger id="past-credits" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {error && (
        <p id="past-name-error" role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <AnimateIcon animateOnHover asChild>
        <Button type="submit" className="h-11 w-full sm:w-auto sm:px-5">
          <Plus size={16} aria-hidden /> Add class
        </Button>
      </AnimateIcon>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function TranscriptPanel() {
  const { transcript, reloadTranscript, cumulative } = useGradebook();
  const prefs = prefsStore.useValue();
  const auto = prefs.gpaSource === "auto";

  const toggle = (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="use-transcript" className="flex flex-col items-start gap-0.5">
        <span>Use my transcript</span>
        <span className="text-xs font-normal text-muted-foreground">
          GradeBoi reads the unofficial transcript in your StudentVUE documents for you.
        </span>
      </Label>
      <Switch
        id="use-transcript"
        checked={auto}
        onCheckedChange={(v) => updatePrefs({ gpaSource: v ? "auto" : "manual" })}
      />
    </div>
  );

  let body: React.ReactNode = null;
  if (!auto) {
    body = null;
  } else if (transcript.status === "LOADING") {
    body = (
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
        <LoaderCircle animate loop size={16} aria-hidden /> Reading your transcript from StudentVUE…
      </div>
    );
  } else if (transcript.status === "FOUND") {
    const t = transcript.transcript;
    const byGrade = new Map<string, typeof t.courses>();
    for (const c of t.courses) {
      const key = c.gradeLevel ? `Grade ${c.gradeLevel}${c.schoolYear ? ` · ${c.schoolYear}` : ""}` : c.schoolYear ?? "Classes";
      byGrade.set(key, [...(byGrade.get(key) ?? []), c]);
    }
    body = (
      <div className="space-y-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{t.document.name}</span>{" "}
            <span className="text-muted-foreground">· posted {fmtLongDate(t.document.date)}</span>
          </p>
          <a
            href={`/api/documents/${encodeURIComponent(t.document.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gold underline-offset-4 hover:underline"
          >
            View transcript
          </a>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <MiniStat label="Unweighted (printed)" value={fmtGpa(t.printed.unweighted ?? t.printed.unlabeled)} />
          <MiniStat
            label={t.printed.weighted !== null ? "Weighted (printed)" : "Weighted"}
            value={t.printed.weighted !== null ? fmtGpa(t.printed.weighted) : cumulative.weightedFromCourses ? "from classes" : "not printed"}
          />
          <MiniStat label="Credits" value={t.gpa.credits === null ? "not printed" : String(t.gpa.credits)} />
        </dl>
        <p className="text-xs text-muted-foreground">
          {cumulative.currentIncluded
            ? "Your cumulative GPA is the transcript's GPA combined with this term's classes, weighted by credits."
            : t.gpa.credits === null
              ? "Your transcript doesn't print a credit total, so the cumulative GPA is the transcript's GPA as of when it was posted."
              : "Your cumulative GPA is the transcript's GPA as of when it was posted."}
        </p>
        {t.courses.length > 0 && (
          <details className="group rounded-xl border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 text-sm font-medium">
              {t.courses.length} classes read from the transcript
              <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              {Array.from(byGrade.entries()).map(([heading, list]) => (
                <div key={heading}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{heading}</p>
                  <ul className="mt-1 divide-y divide-border text-sm">
                    {list.map((c, i) => (
                      <li key={`${heading}-${i}`} className="flex min-h-9 items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {c.term && <span className="mr-2 text-muted-foreground">{c.term}</span>}
                          {c.name}
                        </span>
                        <span className="shrink-0 tabular">
                          {c.letter} <span className="text-muted-foreground">· {c.credits} cr</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  } else {
    const message =
      transcript.status === "NOT_POSTED"
        ? "There's no transcript in your StudentVUE documents yet. You can enter past classes yourself below."
        : transcript.status === "NO_GPA"
          ? "Found your transcript, but couldn't read a GPA from it (it may be a scanned image). Enter past classes yourself below."
          : transcript.status === "UNREADABLE"
            ? "Found your transcript, but it isn't a readable PDF. Enter past classes yourself below."
            : transcript.status === "NOT_SUPPORTED"
              ? "Your district's StudentVUE doesn't share documents with apps. Enter past classes yourself below."
              : "message" in transcript
                ? transcript.message
                : "Couldn't read your transcript.";
    body = (
      <div className="space-y-2 text-sm" aria-live="polite">
        <p className="text-muted-foreground">{message}</p>
        {"document" in transcript && transcript.document && (
          <a
            href={`/api/documents/${encodeURIComponent(transcript.document.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center font-medium text-gold underline-offset-4 hover:underline"
          >
            View transcript
          </a>
        )}
        <button
          type="button"
          onClick={() => void reloadTranscript()}
          className="ml-3 inline-flex min-h-10 items-center font-medium underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Transcript" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      {toggle}
      {body}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}

function fmtLongDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
