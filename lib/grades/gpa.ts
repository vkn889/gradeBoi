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

export type GpaInput = {
  letter: Letter | null;
  level: CourseLevel;
  /** credits the grade is worth (default 1); GPA is a credit-weighted average */
  credits?: number;
};

export type GpaResult = {
  unweighted: number | null;
  weighted: number | null;
  /** number of graded entries */
  count: number;
  /** total credits counted */
  credits: number;
};

/**
 * Credit-weighted GPA on a 4.0 scale. Weighted adds the level bonus to grades of C or better.
 * Entries with no grade (N/A) or zero credits are excluded.
 */
export function computeGpa(courses: GpaInput[], bonus: GpaBonus = DEFAULT_BONUS): GpaResult {
  let u = 0;
  let w = 0;
  let credits = 0;
  let count = 0;
  for (const c of courses) {
    if (c.letter === null || !(c.letter in GPA_POINTS)) continue;
    const cr = c.credits ?? 1;
    if (!(cr > 0)) continue;
    const pts = GPA_POINTS[c.letter];
    const extra = pts >= GPA_POINTS.C ? (c.level === "ap" ? bonus.ap : c.level === "honors" ? bonus.honors : 0) : 0;
    u += pts * cr;
    w += (pts + extra) * cr;
    credits += cr;
    count += 1;
  }
  if (count === 0) return { unweighted: null, weighted: null, count: 0, credits: 0 };
  return { unweighted: u / credits, weighted: w / credits, count, credits };
}
