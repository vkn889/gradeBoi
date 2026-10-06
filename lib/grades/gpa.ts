import type { CourseLevel } from "@/lib/types";
import type { Letter } from "./scale";

export const GPA_POINTS: Record<Letter, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0,
};

export type GpaBonus = { ap: number; honors: number };
export const DEFAULT_BONUS: GpaBonus = { ap: 1.0, honors: 0.5 };

/** Auto-detect course level from its title. */
export function detectLevel(title: string): CourseLevel {
  if (/\bAP\b/.test(title) || /advanced placement/i.test(title)) return "ap";
  if (/\bhon(ors)?\b/i.test(title) || /\bhonours\b/i.test(title)) return "honors";
  return "regular";
}

export type GpaInput = { letter: Letter | null; level: CourseLevel };

export type GpaResult = {
  unweighted: number | null;
  weighted: number | null;
  /** number of classes with a grade */
  count: number;
};

/**
 * Unweighted GPA on a 4.0 scale. Weighted adds the level bonus to classes with a C or better.
 * Classes with no grade are excluded.
 */
export function computeGpa(courses: GpaInput[], bonus: GpaBonus = DEFAULT_BONUS): GpaResult {
  const graded = courses.filter((c): c is { letter: Letter; level: CourseLevel } => c.letter !== null);
  if (graded.length === 0) return { unweighted: null, weighted: null, count: 0 };
  let u = 0;
  let w = 0;
  for (const c of graded) {
    const pts = GPA_POINTS[c.letter];
    u += pts;
    const extra = pts >= GPA_POINTS.C ? (c.level === "ap" ? bonus.ap : c.level === "honors" ? bonus.honors : 0) : 0;
    w += pts + extra;
  }
  return { unweighted: u / graded.length, weighted: w / graded.length, count: graded.length };
}
