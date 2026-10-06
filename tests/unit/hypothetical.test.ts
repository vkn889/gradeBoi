import { describe, expect, it } from "vitest";
import {
  addAssignment,
  applyScenario,
  changeCategory,
  editScore,
  emptyScenario,
  isEmptyScenario,
  pruneScenario,
  removeAssignment,
  reset,
  restoreAssignment,
  revertEdit,
  setWeight,
  setWeights,
  clearWeights,
} from "@/lib/grades/hypothetical";
import { computePercent } from "@/lib/grades/engine";
import type { Course } from "@/lib/types";

const course = (): Course => ({
  id: "1-Math",
  period: 1,
  title: "Math",
  teacher: "T",
  level: "regular",
  official: { percent: 85, letter: "B" },
  weighted: true,
  categories: [
    { name: "Tests", weight: 70 },
    { name: "HW", weight: 30 },
  ],
  assignments: [
    { id: "t1", name: "Test 1", category: "Tests", date: "2026-09-01", score: 80, possible: 100, status: "graded" },
    { id: "h1", name: "HW 1", category: "HW", date: "2026-09-02", score: 10, possible: 10, status: "graded" },
    { id: "h2", name: "HW 2", category: "HW", date: "2026-09-03", score: null, possible: 10, status: "ungraded" },
  ],
});

describe("hypothetical scenarios", () => {
  it("never mutates the real course", () => {
    const real = course();
    const snapshot = JSON.stringify(real);
    let s = editScore(emptyScenario(), "t1", 100, 100);
    s = removeAssignment(s, "h1");
    s = changeCategory(s, "h2", "Tests");
    s = addAssignment(s, { name: "Quiz", category: "Tests", score: 5, possible: 10 });
    applyScenario(real, s);
    expect(JSON.stringify(real)).toBe(snapshot);
  });

  it("edits a score", () => {
    const { course: c } = applyScenario(course(), editScore(emptyScenario(), "t1", 100, 100));
    expect(c.assignments.find((a) => a.id === "t1")).toMatchObject({ score: 100, isEdited: true, status: "graded" });
    expect(computePercent(c)).toBeCloseTo(100);
  });

  it("can un-grade an assignment", () => {
    const { course: c } = applyScenario(course(), editScore(emptyScenario(), "h1", null, 10));
    expect(c.assignments.find((a) => a.id === "h1")?.status).toBe("ungraded");
  });

  it("adds and edits hypothetical assignments", () => {
    let s = addAssignment(emptyScenario(), { name: " ", category: "Tests", score: 50, possible: 100 });
    const id = s.added[0].id;
    expect(id.startsWith("h-")).toBe(true);
    expect(s.added[0].name).toBe("Hypothetical assignment");
    s = editScore(s, id, 100, 100);
    s = changeCategory(s, id, "HW");
    const { course: c } = applyScenario(course(), s);
    expect(c.assignments[0]).toMatchObject({ id, score: 100, category: "HW", isHypothetical: true });
    expect(removeAssignment(s, id).added).toHaveLength(0);
  });

  it("hides removed real assignments and restores them individually", () => {
    let s = removeAssignment(emptyScenario(), "h1");
    s = removeAssignment(s, "h1");
    expect(s.removed).toEqual(["h1"]);
    const applied = applyScenario(course(), s);
    expect(applied.course.assignments.map((a) => a.id)).toEqual(["t1", "h2"]);
    expect(applied.removed.map((a) => a.id)).toEqual(["h1"]);
    s = restoreAssignment(s, "h1");
    expect(applyScenario(course(), s).course.assignments).toHaveLength(3);
  });

  it("changes categories", () => {
    const { course: c } = applyScenario(course(), changeCategory(emptyScenario(), "h1", "Tests"));
    expect(c.assignments.find((a) => a.id === "h1")?.category).toBe("Tests");
    // Tests = 90/110, HW has nothing graded
    expect(computePercent(c)).toBeCloseTo((90 / 110) * 100);
  });

  it("reverts edits", () => {
    let s = editScore(emptyScenario(), "t1", 0, 100);
    s = changeCategory(s, "t1", "HW");
    s = revertEdit(s, "t1");
    expect(isEmptyScenario(s)).toBe(true);
  });

  it("drops edits pointing at assignments that no longer exist", () => {
    let s = editScore(emptyScenario(), "gone", 1, 1);
    s = changeCategory(s, "gone", "Tests");
    s = changeCategory(s, "h1", "NoSuchCategory");
    s = removeAssignment(s, "gone2");
    s = setWeight(s, "Ghost", 10);
    const p = pruneScenario(course(), s);
    expect(p.edits).toEqual({});
    expect(p.categoryChanges).toEqual({});
    expect(p.removed).toEqual([]);
    expect(p.weights).toEqual({});
  });

  it("overrides category weights", () => {
    const { course: c } = applyScenario(course(), setWeight(emptyScenario(), "Tests", 30));
    expect(c.categories.find((x) => x.name === "Tests")?.weight).toBe(30);
  });

  it("turns a points-based class into a weighted one when weights are entered", () => {
    const pts = { ...course(), weighted: false, categories: [] };
    const { course: c } = applyScenario(pts, setWeights(emptyScenario(), { Tests: 50, HW: 50 }));
    expect(c.weighted).toBe(true);
    expect(c.categories).toEqual([
      { name: "Tests", weight: 50 },
      { name: "HW", weight: 50 },
    ]);
    expect(computePercent(c)).toBeCloseTo(90);
    expect(clearWeights(setWeights(emptyScenario(), { Tests: 1 })).weights).toBeUndefined();
  });

  it("resets to an empty scenario", () => {
    expect(isEmptyScenario(reset())).toBe(true);
    expect(isEmptyScenario(undefined)).toBe(true);
    expect(isEmptyScenario(removeAssignment(emptyScenario(), "t1"))).toBe(false);
  });
});
