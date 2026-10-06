import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE, applyRounding, distanceToNextLetter, isValidScale, letterFor } from "@/lib/grades/scale";
import { computeGpa, detectLevel } from "@/lib/grades/gpa";

describe("letterFor", () => {
  it("uses the default scale", () => {
    expect(letterFor(93)).toBe("A");
    expect(letterFor(92.99)).toBe("A-");
    expect(letterFor(89.5)).toBe("B+");
    expect(letterFor(60)).toBe("D");
    expect(letterFor(59.9)).toBe("F");
    expect(letterFor(null)).toBeNull();
  });
  it("rounds half up when enabled", () => {
    expect(letterFor(89.5, DEFAULT_SCALE, "half-up")).toBe("A-");
    expect(letterFor(89.49, DEFAULT_SCALE, "half-up")).toBe("B+");
    expect(applyRounding(89.49999999999, "half-up")).toBe(90);
  });
  it("supports custom scales", () => {
    expect(letterFor(91, { ...DEFAULT_SCALE, A: 90, "A-": 88 })).toBe("A");
  });
});

describe("distanceToNextLetter", () => {
  it("reports distance to next letter and above current cutoff", () => {
    const d = distanceToNextLetter(92.6);
    expect(d.current).toBe("A-");
    expect(d.next).toBe("A");
    expect(d.toNext).toBeCloseTo(0.4);
    expect(d.aboveCurrent).toBeCloseTo(2.6);
  });
  it("has no next letter at the top", () => {
    expect(distanceToNextLetter(97).next).toBeNull();
  });
  it("has no current cutoff for F", () => {
    const d = distanceToNextLetter(50);
    expect(d.current).toBe("F");
    expect(d.next).toBe("D");
    expect(d.toNext).toBeCloseTo(10);
    expect(d.aboveCurrent).toBeNull();
  });
  it("accounts for rounding", () => {
    expect(distanceToNextLetter(92, DEFAULT_SCALE, "half-up").toNext).toBeCloseTo(0.5);
  });
});

describe("isValidScale", () => {
  it("accepts descending cutoffs and rejects others", () => {
    expect(isValidScale(DEFAULT_SCALE)).toBe(true);
    expect(isValidScale({ ...DEFAULT_SCALE, "A-": 95 })).toBe(false);
    expect(isValidScale({ ...DEFAULT_SCALE, D: -1 })).toBe(false);
  });
});

describe("GPA", () => {
  it("weights by credits and skips N/A and zero-credit entries", () => {
    const r = computeGpa([
      { letter: "A", level: "regular", credits: 1 },
      { letter: "C", level: "regular", credits: 0.5 },
      { letter: null, level: "regular", credits: 1 },
      { letter: "F", level: "regular", credits: 0 },
    ]);
    expect(r.unweighted).toBeCloseTo((4 * 1 + 2 * 0.5) / 1.5);
    expect(r.credits).toBeCloseTo(1.5);
    expect(r.count).toBe(2);
  });

  it("detects levels from titles", () => {
    expect(detectLevel("AP Calculus AB")).toBe("ap");
    expect(detectLevel("Advanced Placement Biology")).toBe("ap");
    expect(detectLevel("Honors English 10")).toBe("honors");
    expect(detectLevel("Chemistry Hon")).toBe("honors");
    expect(detectLevel("Chapter Studies")).toBe("regular");
    expect(detectLevel("Honesty Seminar")).toBe("regular");
  });
  it("computes unweighted and weighted GPA", () => {
    const r = computeGpa([
      { letter: "A", level: "ap" },
      { letter: "B+", level: "honors" },
      { letter: "C-", level: "ap" },
      { letter: null, level: "regular" },
    ]);
    expect(r.count).toBe(3);
    expect(r.unweighted).toBeCloseTo((4 + 3.3 + 1.7) / 3);
    // C- gets no bonus (below C)
    expect(r.weighted).toBeCloseTo((5 + 3.8 + 1.7) / 3);
  });
  it("uses a configurable bonus", () => {
    expect(computeGpa([{ letter: "C", level: "honors" }], { ap: 1, honors: 1 }).weighted).toBeCloseTo(3);
  });
  it("returns nulls with no graded classes", () => {
    expect(computeGpa([])).toEqual({ unweighted: null, weighted: null, count: 0, credits: 0 });
  });
});
