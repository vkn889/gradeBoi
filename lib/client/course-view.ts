import type { Assignment, Course } from "@/lib/types";
import { computePercent, displayPercent } from "@/lib/grades/engine";
import { applyScenario, emptyScenario, isEmptyScenario, type AppliedCourse, type Scenario } from "@/lib/grades/hypothetical";
import { letterFor, type Letter } from "@/lib/grades/scale";
import { GPA_POINTS, computeGpa, type GpaResult } from "@/lib/grades/gpa";
import type { CourseScenarios, Prefs, ScenarioStore, SeenStore } from "./storage";

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
    letter:
      disp.percent === null ? asLetter(course.official.letter) : letterFor(disp.percent, prefs.scale, prefs.rounding),
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
    if (isEmptyScenario(scenario)) p = real.percent ?? p;
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
