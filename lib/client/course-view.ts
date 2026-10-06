import type { Assignment, Course, CourseLevel } from "@/lib/types";
import { computePercent, displayPercent, isNoGrade } from "@/lib/grades/engine";
import { applyScenario, emptyScenario, isEmptyScenario, type AppliedCourse, type Scenario } from "@/lib/grades/hypothetical";
import { letterFor, type Letter } from "@/lib/grades/scale";
import { GPA_POINTS, computeGpa, type GpaResult } from "@/lib/grades/gpa";
import type { CourseScenarios, PastCourse, Prefs, ScenarioStore, SeenStore } from "./storage";

// Pure derivation of what the UI shows for each course. No React here.

export const DEFAULT_SCENARIO_NAME = "My scenario";

export type GradeShown = { percent: number | null; letter: Letter | null };

export type CourseView = {
  /** "<reportPeriod>|<courseId>" — scenarios are per grading period */
  key: string;
  /** real course, with the user's level override applied */
  course: Course;
  real: GradeShown & { mismatch: boolean; computed: number | null };
  hypoEnabled: boolean;
  scenarioName: string;
  scenario: Scenario;
  applied: AppliedCourse | null;
  /** null when hypothetical mode is off */
  hypo: GradeShown | null;
  delta: number | null;
  /** grade that counts toward GPA (hypothetical when enabled) */
  effective: GradeShown;
  newIds: Set<string>;
  missing: Assignment[];
  late: Assignment[];
};

export function scenarioKey(period: number, courseId: string) {
  return `${period}|${courseId}`;
}

export function activeScenario(entry: CourseScenarios | undefined): { name: string; scenario: Scenario } {
  if (!entry) return { name: DEFAULT_SCENARIO_NAME, scenario: emptyScenario() };
  const name = entry.active in entry.saved ? entry.active : Object.keys(entry.saved)[0] ?? DEFAULT_SCENARIO_NAME;
  return { name, scenario: entry.saved[name] ?? emptyScenario() };
}

/** Only letters on the GPA scale count; "P", "N/A", etc. are treated as no grade. */
function asLetter(raw: string | null): Letter | null {
  if (!raw) return null;
  const l = raw.trim().toUpperCase();
  return l in GPA_POINTS ? (l as Letter) : null;
}

export function gradedIds(course: Course): string[] {
  return course.assignments.filter((a) => a.score !== null && a.status !== "notForGrading").map((a) => a.id);
}

export function buildCourseView(
  raw: Course,
  period: number,
  prefs: Prefs,
  scenarios: ScenarioStore,
  seen: SeenStore,
): CourseView {
  const level = prefs.levelOverrides[raw.id] ?? raw.level;
  const course: Course = level === raw.level ? raw : { ...raw, level };
  const key = scenarioKey(period, raw.id);

  const disp = displayPercent(course);
  const real = {
    percent: disp.percent,
    computed: disp.computed,
    mismatch: disp.mismatch,
    // No percent: only trust StudentVUE's letter when it sent no percent at all (a 0.0% is N/A).
    letter:
      disp.percent === null
        ? course.official.percent === null
          ? asLetter(course.official.letter)
          : null
        : letterFor(disp.percent, prefs.scale, prefs.rounding),
  };

  const entry = scenarios[key];
  const { name, scenario } = activeScenario(entry);
  const hypoEnabled = Boolean(entry?.enabled);

  let applied: AppliedCourse | null = null;
  let hypo: GradeShown | null = null;
  let delta: number | null = null;
  if (hypoEnabled) {
    applied = applyScenario(course, scenario);
    let p = computePercent(applied.course);
    // When our math disagrees with StudentVUE, keep the same offset so an untouched
    // scenario shows exactly the official grade.
    if (p !== null && disp.mismatch && disp.computed !== null && disp.percent !== null) {
      p += disp.percent - disp.computed;
    }
    if (isEmptyScenario(scenario)) p = real.percent;
    else if (isNoGrade(p)) p = null;
    hypo = { percent: p, letter: letterFor(p, prefs.scale, prefs.rounding) };
    delta = p !== null && real.percent !== null ? p - real.percent : null;
  }

  const seenList = seen[key];
  const newIds = new Set<string>();
  if (seenList) {
    const s = new Set(seenList);
    for (const id of gradedIds(course)) if (!s.has(id)) newIds.add(id);
  }

  return {
    key,
    course,
    real,
    hypoEnabled,
    scenarioName: name,
    scenario,
    applied,
    hypo,
    delta,
    effective: hypo ?? real,
    newIds,
    missing: course.assignments.filter((a) => a.status === "missing"),
    late: course.assignments.filter((a) => a.status === "late"),
  };
}

export function gpaFor(views: CourseView[], prefs: Prefs, which: "real" | "effective" = "effective"): GpaResult {
  return computeGpa(
    views.map((v) => ({ letter: (which === "real" ? v.real : v.effective).letter, level: v.course.level })),
    prefs.bonus,
  );
}

export type TranscriptGpa = {
  unweighted: number | null;
  weighted: number | null;
  credits: number | null;
  courses: { letter: Letter; level: CourseLevel; credits: number }[];
};

export type CumulativeResult = GpaResult & {
  /** where past years came from */
  source: "transcript" | "manual" | "term";
  /** whether this term's classes are part of the number */
  currentIncluded: boolean;
  /** the transcript's weighted GPA wasn't printed and was computed from its classes */
  weightedFromCourses: boolean;
};

function combine(pastValue: number | null, pastCredits: number, curValue: number | null, curCredits: number): number | null {
  if (pastValue === null) return null;
  if (curValue === null || curCredits <= 0) return pastValue;
  return (pastValue * pastCredits + curValue * curCredits) / (pastCredits + curCredits);
}

/**
 * Cumulative high-school GPA. Past years come from the unofficial transcript in StudentVUE
 * (the GPA printed on it, weighted by its credits) or, failing that, from classes the student
 * typed in. This grading period's classes are added on top, each worth `prefs.currentCredits`.
 * N/A grades never count.
 */
export function cumulativeGpaFor(
  views: CourseView[],
  history: PastCourse[],
  prefs: Prefs,
  which: "real" | "effective" = "effective",
  transcript: TranscriptGpa | null = null,
): CumulativeResult {
  const current = prefs.includeCurrent
    ? views.map((v) => ({
        letter: (which === "real" ? v.real : v.effective).letter,
        level: v.course.level,
        credits: prefs.currentCredits,
      }))
    : [];

  const useTranscript = prefs.gpaSource === "auto" && transcript !== null && transcript.unweighted !== null;
  if (useTranscript) {
    const t = transcript!;
    let weighted = t.weighted;
    let weightedFromCourses = false;
    if (weighted === null && t.courses.length) {
      weighted = computeGpa(t.courses, prefs.bonus).weighted;
      weightedFromCourses = weighted !== null;
    }
    const cur = computeGpa(current, prefs.bonus);
    // Without the transcript's credit total there's no fair way to weight this term in.
    const canCombine = t.credits !== null && t.credits > 0 && cur.count > 0;
    const pastCredits = t.credits ?? 0;
    return {
      unweighted: canCombine ? combine(t.unweighted, pastCredits, cur.unweighted, cur.credits) : t.unweighted,
      weighted: canCombine ? combine(weighted, pastCredits, cur.weighted, cur.credits) : weighted,
      count: cur.count + Math.max(t.courses.length, 1),
      credits: pastCredits + (canCombine ? cur.credits : 0),
      source: "transcript",
      currentIncluded: canCombine,
      weightedFromCourses,
    };
  }

  const past = history.map((h) => ({ letter: h.letter, level: h.level, credits: h.credits }));
  const g = computeGpa([...past, ...current], prefs.bonus);
  return {
    ...g,
    source: history.length ? "manual" : "term",
    currentIncluded: current.length > 0,
    weightedFromCourses: false,
  };
}
