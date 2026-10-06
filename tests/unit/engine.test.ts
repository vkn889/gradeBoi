import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCURACY_TOLERANCE,
  assignmentImpacts,
  computeCourse,
  computePercent,
  displayPercent,
  finalExamNeeded,
  gradeHistory,
  isNoGrade,
  pointValue,
  solveNeededScore,
} from "@/lib/grades/engine";
import { parseGradebook } from "@/lib/studentvue/parse";
import { DEMO_PERIODS, demoGradebookXml } from "@/lib/demo/generate";
import type { Assignment, Course } from "@/lib/types";

const a = (id: string, category: string, score: number | null, possible: number, extra: Partial<Assignment> = {}): Assignment => ({
  id,
  name: id,
  category,
  date: "2026-09-10",
  score,
  possible,
  status: score === null ? "ungraded" : "graded",
  ...extra,
});

const weighted = (assignments: Assignment[], categories = [
  { name: "Tests", weight: 60 },
  { name: "HW", weight: 40 },
]): Course => ({
  id: "1-X",
  period: 1,
  title: "X",
  teacher: "T",
  level: "regular",
  official: { percent: null, letter: null },
  weighted: true,
  categories,
  assignments,
});

describe("weighted classes", () => {
  it("weights category percents", () => {
    const c = weighted([a("1", "Tests", 90, 100), a("2", "HW", 8, 10)]);
    expect(computePercent(c)).toBeCloseTo(0.6 * 90 + 0.4 * 80, 10);
  });
  it("drops categories with no graded work and re-normalizes", () => {
    const c = weighted([a("1", "Tests", 45, 50), a("2", "HW", null, 10)]);
    expect(computePercent(c)).toBeCloseTo(90, 10);
    const cats = computeCourse(c).categories;
    expect(cats.find((x) => x.name === "Tests")?.effectiveWeight).toBeCloseTo(100);
    expect(cats.find((x) => x.name === "HW")?.percent).toBeNull();
  });
  it("ignores excused / not-for-grading even with a score", () => {
    const c = weighted([
      a("1", "Tests", 90, 100),
      a("2", "Tests", 0, 100, { status: "excused" }),
      a("3", "Tests", 0, 100, { status: "notForGrading" }),
    ]);
    expect(computePercent(c)).toBeCloseTo(90);
  });
  it("counts missing work with a zero", () => {
    const c = weighted([a("1", "Tests", 90, 100), a("2", "Tests", 0, 100, { status: "missing" })]);
    expect(computePercent(c)).toBeCloseTo(45);
  });
  it("treats extra credit as earned-only points", () => {
    const c = weighted([a("1", "HW", 10, 10), a("2", "HW", 2, 0)], [{ name: "HW", weight: 100 }]);
    expect(computePercent(c)).toBeCloseTo(120);
  });
  it("returns null with no graded work", () => {
    expect(computePercent(weighted([a("1", "Tests", null, 10)]))).toBeNull();
  });
  it("reports points lost per category", () => {
    const c = weighted([a("1", "Tests", 50, 100), a("2", "HW", 10, 10)]);
    const t = computeCourse(c).categories.find((x) => x.name === "Tests")!;
    expect(t.pointsLost).toBeCloseTo(30);
  });
});

describe("points-based classes", () => {
  const pts = (assignments: Assignment[]): Course => ({ ...weighted(assignments), weighted: false, categories: [] });
  it("sums earned over possible", () => {
    expect(computePercent(pts([a("1", "A", 45, 50), a("2", "B", 5, 50)]))).toBeCloseTo(50);
  });
  it("lists categories found on assignments", () => {
    const r = computeCourse(pts([a("1", "A", 45, 50), a("2", "B", 5, 50)]));
    expect(r.categories.map((c) => c.name)).toEqual(["A", "B"]);
    expect(r.categories[1].pointsLost).toBeCloseTo(45);
  });
  it("handles extra credit with possible = 0", () => {
    expect(computePercent(pts([a("1", "A", 9, 10), a("2", "A", 1, 0)]))).toBeCloseTo(100);
  });
  it("returns null when nothing is graded", () => {
    expect(computePercent(pts([]))).toBeNull();
  });
});

describe("displayPercent", () => {
  const base = weighted([a("1", "Tests", 90, 100)], [{ name: "Tests", weight: 100 }]);
  it("uses computed when it matches official", () => {
    const d = displayPercent({ ...base, official: { percent: 90.05, letter: "A-" } });
    expect(d).toEqual({ percent: 90, computed: 90, mismatch: false });
  });
  it("uses official when they disagree by more than 0.1%", () => {
    const d = displayPercent({ ...base, official: { percent: 91, letter: "A-" } });
    expect(d.percent).toBe(91);
    expect(d.mismatch).toBe(true);
  });
  it("falls back to whichever exists", () => {
    expect(displayPercent(base).percent).toBe(90);
    expect(displayPercent({ ...base, assignments: [], official: { percent: 77, letter: "C+" } }).percent).toBe(77);
  });
});

describe("accuracy check: every fixture course matches its official percent within 0.1%", () => {
  const fixtures: { name: string; xml: string }[] = [
    { name: "edge-cases", xml: readFileSync(join(__dirname, "../fixtures/edge-cases.xml"), "utf8") },
    ...DEMO_PERIODS.map((p) => ({ name: `demo-${p.name}`, xml: demoGradebookXml(p.index, new Date(2026, 9, 5)) })),
    ...DEMO_PERIODS.map((p) => ({ name: `demo-${p.name}-feb`, xml: demoGradebookXml(p.index, new Date(2027, 1, 28)) })),
  ];
  for (const f of fixtures) {
    for (const course of parseGradebook(f.xml).courses) {
      it(`${f.name}: ${course.title}`, () => {
        const computed = computePercent(course);
        if (isNoGrade(course.official.percent)) {
          // No official grade (or 0.0% = nothing entered yet): nothing should be computed either.
          expect(computed).toBeNull();
          expect(displayPercent(course).percent).toBeNull();
        } else {
          expect(computed).not.toBeNull();
          expect(Math.abs((computed as number) - (course.official.percent as number))).toBeLessThanOrEqual(ACCURACY_TOLERANCE);
        }
      });
    }
  }
});

describe("0.0% means no grade yet (N/A)", () => {
  it("treats an official 0.0% as no grade", () => {
    const empty = weighted([a("1", "Tests", null, 10)], [{ name: "Tests", weight: 100 }]);
    expect(displayPercent({ ...empty, official: { percent: 0, letter: "F" } }).percent).toBeNull();
  });
  it("treats a computed 0.0% with no official grade as no grade", () => {
    const zero = weighted([a("1", "Tests", 0, 10)], [{ name: "Tests", weight: 100 }]);
    expect(displayPercent(zero).percent).toBeNull();
    expect(isNoGrade(0)).toBe(true);
    expect(isNoGrade(0.4)).toBe(false);
  });
});

describe("solveNeededScore", () => {
  const c = weighted([a("1", "Tests", 80, 100), a("2", "HW", 10, 10), a("up", "Tests", null, 100)]);
  it("finds the minimum score to hit a target within 0.01%", () => {
    const r = solveNeededScore(c, "up", 90)!;
    // Tests avg must reach (90-40)/0.6 = 83.33 -> (80+x)/200 = .8333 -> x = 86.67
    expect(r.score).toBeCloseTo(86.67, 1);
    expect(r.percentAtScore).toBeGreaterThanOrEqual(90 - 0.01);
  });
  it("returns 0 when the target is already safe", () => {
    expect(solveNeededScore(c, "up", 50)?.score).toBe(0);
  });
  it("returns null when not reachable with 2x possible", () => {
    expect(solveNeededScore(c, "up", 130)).toBeNull();
  });
  it("returns null for unknown or zero-point assignments", () => {
    expect(solveNeededScore(c, "nope", 90)).toBeNull();
    expect(solveNeededScore(weighted([a("z", "HW", null, 0)]), "z", 90)).toBeNull();
  });
});

describe("finalExamNeeded", () => {
  it("computes the needed final score", () => {
    expect(finalExamNeeded(88, 90, 20)).toBeCloseTo(98);
    expect(finalExamNeeded(95, 90, 20)).toBeCloseTo(70);
  });
  it("rejects invalid weights", () => {
    expect(finalExamNeeded(90, 90, 0)).toBeNull();
    expect(finalExamNeeded(90, 90, 150)).toBeNull();
  });
});

describe("pointValue / impacts / history", () => {
  const c = weighted([a("1", "Tests", 80, 100, { date: "2026-09-01" }), a("2", "HW", 5, 10, { date: "2026-09-05" })]);
  it("measures how much one point moves the grade", () => {
    expect(pointValue(c, "1")).toBeCloseTo(0.6, 5);
    expect(pointValue(c, "2")).toBeCloseTo(4, 5);
    expect(pointValue(c, "missing")).toBeNull();
    expect(pointValue(weighted([a("u", "HW", null, 10)]), "u")).toBeNull();
  });
  it("ranks assignments by impact", () => {
    const imp = assignmentImpacts(c);
    expect(imp).toHaveLength(2);
    // Grade with both = 68. Without the test it's 50 (test helps +18); without HW it's 80 (HW hurts -12).
    expect(imp[0].assignment.id).toBe("1");
    expect(imp[0].impact).toBeCloseTo(18);
    expect(imp[1].assignment.id).toBe("2");
    expect(imp[1].impact).toBeCloseTo(-12);
    expect(assignmentImpacts(weighted([]))).toEqual([]);
  });
  it("builds a running grade history by date", () => {
    const h = gradeHistory(c);
    expect(h.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-05"]);
    expect(h[0].percent).toBeCloseTo(80);
    expect(h[1].percent).toBeCloseTo(68);
  });
});
