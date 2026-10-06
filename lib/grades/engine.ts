import type { Assignment, Course } from "@/lib/types";

// Pure grade math. No UI or network code lives in lib/grades/.

/** Statuses that never count toward the grade, even with a score. */
const EXCLUDED_STATUSES = new Set(["excused", "notForGrading"]);

/** An assignment counts when it has a score and is not excused / not for grading. */
export function countsTowardGrade(a: Assignment): boolean {
  return a.score !== null && !EXCLUDED_STATUSES.has(a.status);
}

export type CategoryResult = {
  name: string;
  weight: number;
  earned: number;
  possible: number;
  /** 0-100, null when the category has no graded work */
  percent: number | null;
  /** weight after re-normalizing over graded categories (0-100) */
  effectiveWeight: number;
  /** percentage points of the class grade lost to this category */
  pointsLost: number;
};

export type CourseResult = {
  percent: number | null;
  categories: CategoryResult[];
};

function sumPoints(assignments: Assignment[]) {
  let earned = 0;
  let possible = 0;
  for (const a of assignments) {
    if (!countsTowardGrade(a)) continue;
    // Extra credit (score > possible, or possible = 0 with a score) simply adds earned points.
    earned += a.score as number;
    possible += a.possible;
  }
  return { earned, possible };
}

/**
 * Computes the class percent.
 * Weighted: categories with no graded work are dropped and remaining weights re-normalized.
 * Points-based: total earned / total possible.
 */
export function computeCourse(course: Pick<Course, "weighted" | "categories" | "assignments">): CourseResult {
  const { assignments } = course;

  if (!course.weighted) {
    const { earned, possible } = sumPoints(assignments);
    const percent = possible > 0 ? (earned / possible) * 100 : null;
    const names = uniqueCategoryNames(course);
    const categories: CategoryResult[] = names.map((name) => {
      const s = sumPoints(assignments.filter((a) => a.category === name));
      return {
        name,
        weight: 0,
        earned: s.earned,
        possible: s.possible,
        percent: s.possible > 0 ? (s.earned / s.possible) * 100 : null,
        effectiveWeight: possible > 0 ? (s.possible / possible) * 100 : 0,
        pointsLost: possible > 0 ? ((s.possible - s.earned) / possible) * 100 : 0,
      };
    });
    return { percent, categories };
  }

  const byName = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = byName.get(a.category) ?? [];
    list.push(a);
    byName.set(a.category, list);
  }

  const raw = course.categories.map((c) => {
    const s = sumPoints(byName.get(c.name) ?? []);
    const percent = s.possible > 0 ? (s.earned / s.possible) * 100 : null;
    return { name: c.name, weight: c.weight, earned: s.earned, possible: s.possible, percent };
  });

  const gradedWeight = raw.reduce((t, c) => (c.percent !== null ? t + c.weight : t), 0);
  let weightedSum = 0;
  for (const c of raw) {
    if (c.percent !== null) weightedSum += c.weight * (c.percent / 100);
  }
  const percent = gradedWeight > 0 ? (weightedSum / gradedWeight) * 100 : null;

  const categories: CategoryResult[] = raw.map((c) => {
    const effectiveWeight = c.percent !== null && gradedWeight > 0 ? (c.weight / gradedWeight) * 100 : 0;
    return {
      ...c,
      effectiveWeight,
      pointsLost: c.percent !== null ? (effectiveWeight * (100 - c.percent)) / 100 : 0,
    };
  });

  return { percent, categories };
}

function uniqueCategoryNames(course: Pick<Course, "categories" | "assignments">): string[] {
  const names = course.categories.map((c) => c.name);
  for (const a of course.assignments) if (!names.includes(a.category)) names.push(a.category);
  return names;
}

export function computePercent(course: Pick<Course, "weighted" | "categories" | "assignments">): number | null {
  return computeCourse(course).percent;
}

/** Tolerance for matching StudentVUE's official percent (SRD R6). */
export const ACCURACY_TOLERANCE = 0.1;

export type DisplayPercent = {
  /** the value to show for the real grade */
  percent: number | null;
  computed: number | null;
  /** true when computed differs from official by more than the tolerance */
  mismatch: boolean;
};

/**
 * A class at exactly 0.0% means nothing has been entered in the gradebook yet, not an F.
 * Such classes show "N/A" and are left out of every GPA.
 */
export function isNoGrade(percent: number | null): boolean {
  return percent === null || Math.abs(percent) < 1e-9;
}

/** Real grade to display: computed, unless it disagrees with StudentVUE, then official wins. */
export function displayPercent(course: Course): DisplayPercent {
  const rawComputed = computePercent(course);
  const computed = isNoGrade(rawComputed) ? null : rawComputed;
  const official = isNoGrade(course.official.percent) ? null : course.official.percent;
  if (official === null) return { percent: computed, computed, mismatch: false };
  if (computed === null) return { percent: official, computed, mismatch: false };
  const mismatch = Math.abs(computed - official) > ACCURACY_TOLERANCE;
  return { percent: mismatch ? official : computed, computed, mismatch };
}

/**
 * "What do I need?" solver. Binary-searches the target assignment's score between
 * 0 and 2x possible until the class grade reaches the target within 0.01%.
 * Returns the minimal score, or null when even 2x possible falls short.
 */
export function solveNeededScore(
  course: Pick<Course, "weighted" | "categories" | "assignments">,
  assignmentId: string,
  target: number,
): { score: number; percentAtScore: number } | null {
  const idx = course.assignments.findIndex((a) => a.id === assignmentId);
  if (idx === -1) return null;
  const base = course.assignments[idx];
  if (!(base.possible > 0)) return null;
  const max = base.possible * 2;

  const gradeAt = (score: number) => {
    const assignments = course.assignments.slice();
    assignments[idx] = { ...base, score, status: "graded" };
    return computePercent({ ...course, assignments }) ?? 0;
  };

  if (gradeAt(max) < target - 0.01) return null;
  const atZero = gradeAt(0);
  if (atZero >= target) return { score: 0, percentAtScore: atZero };

  let lo = 0;
  let hi = max;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const g = gradeAt(mid);
    if (g >= target) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-4) break;
  }
  // hi is the smallest score found that reaches the target; round up to 0.01 points.
  const score = Math.ceil(hi * 100 - 1e-7) / 100;
  return { score, percentAtScore: gradeAt(score) };
}

/** Score needed on a final exam worth `finalWeight`% of the term grade to reach `target`. */
export function finalExamNeeded(current: number, target: number, finalWeight: number): number | null {
  if (finalWeight <= 0 || finalWeight > 100) return null;
  const w = finalWeight / 100;
  return (target - current * (1 - w)) / w;
}

/** How many percentage points the class grade moves when this assignment gains one point. */
export function pointValue(
  course: Pick<Course, "weighted" | "categories" | "assignments">,
  assignmentId: string,
): number | null {
  const base = computePercent(course);
  const idx = course.assignments.findIndex((a) => a.id === assignmentId);
  if (base === null || idx === -1) return null;
  const a = course.assignments[idx];
  if (!countsTowardGrade(a)) return null;
  const assignments = course.assignments.slice();
  assignments[idx] = { ...a, score: (a.score as number) + 1 };
  const next = computePercent({ ...course, assignments });
  return next === null ? null : next - base;
}

export type Impact = { assignment: Assignment; impact: number };

/** For each graded assignment: class grade with it minus class grade without it. */
export function assignmentImpacts(course: Pick<Course, "weighted" | "categories" | "assignments">): Impact[] {
  const base = computePercent(course);
  if (base === null) return [];
  const out: Impact[] = [];
  course.assignments.forEach((a, i) => {
    if (!countsTowardGrade(a)) return;
    const assignments = course.assignments.filter((_, j) => j !== i);
    const without = computePercent({ ...course, assignments });
    if (without === null) return;
    out.push({ assignment: a, impact: base - without });
  });
  return out.sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact));
}

/** Running class grade after each assignment date (for the grade-over-time chart). */
export function gradeHistory(
  course: Pick<Course, "weighted" | "categories" | "assignments">,
): { date: string; time: number; percent: number }[] {
  const graded = course.assignments.filter((a) => countsTowardGrade(a) && !Number.isNaN(Date.parse(a.date)));
  const times = Array.from(new Set(graded.map((a) => Date.parse(a.date)))).sort((a, b) => a - b);
  const out: { date: string; time: number; percent: number }[] = [];
  for (const t of times) {
    const subset = graded.filter((a) => Date.parse(a.date) <= t);
    const p = computePercent({ ...course, assignments: subset });
    if (p !== null) out.push({ date: new Date(t).toISOString().slice(0, 10), time: t, percent: p });
  }
  return out;
}
