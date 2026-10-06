import { describe, expect, it } from "vitest";
import { buildCourseView, cumulativeGpaFor, gpaFor } from "@/lib/client/course-view";
import { DEFAULT_PREFS, type PastCourse } from "@/lib/client/storage";
import type { Course } from "@/lib/types";

const course = (id: string, official: number | null, letter: string | null, graded: boolean, title = id): Course => ({
  id,
  period: 1,
  title,
  teacher: "T",
  level: "regular",
  official: { percent: official, letter },
  weighted: false,
  categories: [],
  assignments: graded
    ? [{ id: `${id}-a`, name: "A", category: "X", date: "2026-09-01", score: official ?? 0, possible: 100, status: "graded" }]
    : [{ id: `${id}-a`, name: "A", category: "X", date: "2026-09-01", score: null, possible: 100, status: "ungraded" }],
});

const view = (c: Course) => buildCourseView(c, 1, DEFAULT_PREFS, {}, {});

describe("0.0% classes are N/A and excluded from GPA", () => {
  it("shows no letter for an official 0.0% / F with nothing graded", () => {
    const v = view(course("health", 0, "F", false));
    expect(v.real.percent).toBeNull();
    expect(v.real.letter).toBeNull();
  });
  it("keeps StudentVUE's letter when it sends a letter but no percent", () => {
    expect(view(course("pe", null, "A", false)).real.letter).toBe("A");
  });
  it("leaves N/A classes out of the term GPA", () => {
    const views = [view(course("math", 95, "A", true)), view(course("health", 0, "F", false))];
    const g = gpaFor(views, DEFAULT_PREFS);
    expect(g.count).toBe(1);
    expect(g.unweighted).toBe(4);
  });
});

describe("cumulative GPA across all years", () => {
  const past: PastCourse[] = [
    { id: "1", gradeLevel: 9, term: "S1", name: "English 9", letter: "B", level: "regular", credits: 0.5 },
    { id: "2", gradeLevel: 10, term: "Year", name: "AP World", letter: "A", level: "ap", credits: 1 },
  ];
  const views = [view(course("math", 95, "A", true)), view(course("health", 0, "F", false))];

  it("credit-weights past years with this term's classes", () => {
    const g = cumulativeGpaFor(views, past, DEFAULT_PREFS);
    // B 3.0 x 0.5 + A 4.0 x 1 + current A 4.0 x 0.5 = 7.5 over 2 credits
    expect(g.unweighted).toBeCloseTo(7.5 / 2);
    // AP bonus +1.0 on the 1-credit AP class
    expect(g.weighted).toBeCloseTo(8.5 / 2);
    expect(g.credits).toBeCloseTo(2);
  });
  it("can exclude the current term", () => {
    const g = cumulativeGpaFor(views, past, { ...DEFAULT_PREFS, includeCurrent: false });
    expect(g.credits).toBeCloseTo(1.5);
  });
  it("is just this term when no past years are entered", () => {
    expect(cumulativeGpaFor(views, [], DEFAULT_PREFS).unweighted).toBe(4);
  });
});

describe("cumulative GPA from the StudentVUE transcript", () => {
  const views = [view(course("math", 95, "A", true)), view(course("health", 0, "F", false))];
  const transcript = { unweighted: 3.5, weighted: 3.75, credits: 6, courses: [] };

  it("combines the printed transcript GPA with this term, weighted by credits", () => {
    const g = cumulativeGpaFor(views, [], DEFAULT_PREFS, "effective", transcript);
    // (3.5 x 6 + 4.0 x 0.5) / 6.5
    expect(g.unweighted).toBeCloseTo((3.5 * 6 + 4 * 0.5) / 6.5);
    expect(g.weighted).toBeCloseTo((3.75 * 6 + 4 * 0.5) / 6.5);
    expect(g).toMatchObject({ source: "transcript", currentIncluded: true, credits: 6.5 });
  });

  it("uses the transcript GPA as-is when it prints no credit total", () => {
    const g = cumulativeGpaFor(views, [], DEFAULT_PREFS, "effective", { ...transcript, credits: null });
    expect(g).toMatchObject({ unweighted: 3.5, weighted: 3.75, currentIncluded: false });
  });

  it("computes weighted from the transcript's classes when only unweighted is printed", () => {
    const g = cumulativeGpaFor(views, [], { ...DEFAULT_PREFS, includeCurrent: false }, "effective", {
      unweighted: 3.85,
      weighted: null,
      credits: 1,
      courses: [
        { letter: "A", level: "ap", credits: 0.5 },
        { letter: "A-", level: "regular", credits: 0.5 },
      ],
    });
    expect(g.weightedFromCourses).toBe(true);
    expect(g.weighted).toBeCloseTo((5 + 3.7) / 2);
  });

  it("ignores typed-in classes while the transcript is used, and uses them when switched to manual", () => {
    const past: PastCourse[] = [{ id: "x", gradeLevel: 9, term: "S1", name: "Art", letter: "C", level: "regular", credits: 0.5 }];
    expect(cumulativeGpaFor(views, past, DEFAULT_PREFS, "effective", transcript).source).toBe("transcript");
    const manual = cumulativeGpaFor(views, past, { ...DEFAULT_PREFS, gpaSource: "manual" }, "effective", transcript);
    expect(manual.source).toBe("manual");
    expect(manual.unweighted).toBeCloseTo((2 + 4) / 2);
  });
});
