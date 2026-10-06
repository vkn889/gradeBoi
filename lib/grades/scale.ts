// Letter grades, grade scales, and rounding.

export const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D"] as const;
export type Letter = (typeof LETTERS)[number] | "F";

/** Minimum percent for each letter. Anything below D is F. */
export type GradeScale = Record<(typeof LETTERS)[number], number>;

export const DEFAULT_SCALE: GradeScale = {
  A: 93,
  "A-": 90,
  "B+": 87,
  B: 83,
  "B-": 80,
  "C+": 77,
  C: 73,
  "C-": 70,
  "D+": 67,
  D: 60,
};

/** "none": 89.99 is a B+. "half-up": 89.5 rounds to 90 before the lookup. */
export type Rounding = "none" | "half-up";

export function applyRounding(percent: number, rounding: Rounding): number {
  // Round to 6 decimals first so floating-point noise (89.49999999) can't flip a letter.
  const clean = Math.round(percent * 1e6) / 1e6;
  return rounding === "half-up" ? Math.floor(clean + 0.5) : clean;
}

export function letterFor(percent: number | null, scale: GradeScale = DEFAULT_SCALE, rounding: Rounding = "none"): Letter | null {
  if (percent === null || Number.isNaN(percent)) return null;
  const p = applyRounding(percent, rounding);
  for (const l of LETTERS) if (p >= scale[l]) return l;
  return "F";
}

/** Cutoff a percent must reach for a letter, accounting for rounding. */
function effectiveCutoff(cutoff: number, rounding: Rounding) {
  return rounding === "half-up" ? cutoff - 0.5 : cutoff;
}

export type LetterDistance = {
  current: Letter;
  /** next letter up, null at the top */
  next: Letter | null;
  /** percentage points needed to reach the next letter */
  toNext: number | null;
  /** percentage points above the current letter's cutoff (null for F) */
  aboveCurrent: number | null;
};

/** "0.4% from an A" / "1.2% above the B cutoff". */
export function distanceToNextLetter(
  percent: number,
  scale: GradeScale = DEFAULT_SCALE,
  rounding: Rounding = "none",
): LetterDistance {
  const current = letterFor(percent, scale, rounding) as Letter;
  const order: Letter[] = [...LETTERS, "F"];
  const i = order.indexOf(current);
  const next = i > 0 ? order[i - 1] : null;
  const toNext = next ? effectiveCutoff(scale[next as keyof GradeScale], rounding) - percent : null;
  const aboveCurrent = current === "F" ? null : percent - effectiveCutoff(scale[current as keyof GradeScale], rounding);
  return {
    current,
    next,
    toNext: toNext !== null ? Math.max(0, toNext) : null,
    aboveCurrent: aboveCurrent !== null ? Math.max(0, aboveCurrent) : null,
  };
}

/** Validates a user-edited scale: every cutoff 0-100 and strictly descending. */
export function isValidScale(scale: GradeScale): boolean {
  let prev = Infinity;
  for (const l of LETTERS) {
    const v = scale[l];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 100 || v >= prev) return false;
    prev = v;
  }
  return true;
}
