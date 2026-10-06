import type { Assignment, Course } from "@/lib/types";

/**
 * A hypothetical scenario is a list of edits on top of a real course. Edits are stored
 * (not the edited course) so they can be re-applied after a refresh, and edits pointing
 * at assignments that no longer exist are dropped.
 */
export type Scenario = {
  /** real assignment id -> new score/possible */
  edits: Record<string, { score: number | null; possible: number }>;
  /** real assignment id -> new category */
  categoryChanges: Record<string, string>;
  /** real assignment ids that are hidden (not deleted, so they can be restored) */
  removed: string[];
  /** assignments added in hypothetical mode (ids start with "h-") */
  added: Assignment[];
  /** category name -> weight override (for districts that don't send weights) */
  weights?: Record<string, number>;
};

export const emptyScenario = (): Scenario => ({ edits: {}, categoryChanges: {}, removed: [], added: [] });

export function isEmptyScenario(s: Scenario | undefined): boolean {
  if (!s) return true;
  return (
    Object.keys(s.edits).length === 0 &&
    Object.keys(s.categoryChanges).length === 0 &&
    s.removed.length === 0 &&
    s.added.length === 0 &&
    Object.keys(s.weights ?? {}).length === 0
  );
}

export function deepCopyCourse(course: Course): Course {
  return structuredClone(course);
}

/** Drops edits that point at assignments or categories that no longer exist. */
export function pruneScenario(course: Course, s: Scenario): Scenario {
  const ids = new Set(course.assignments.map((a) => a.id));
  const cats = new Set(course.categories.map((c) => c.name));
  for (const a of course.assignments) cats.add(a.category);
  const keep = <T,>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([id]) => ids.has(id))) as Record<string, T>;
  return {
    edits: keep(s.edits),
    categoryChanges: Object.fromEntries(
      Object.entries(s.categoryChanges).filter(([id, cat]) => ids.has(id) && cats.has(cat)),
    ),
    removed: s.removed.filter((id) => ids.has(id)),
    added: s.added.filter((a) => cats.has(a.category)),
    weights: s.weights
      ? Object.fromEntries(Object.entries(s.weights).filter(([name]) => cats.has(name)))
      : undefined,
  };
}

export type AppliedCourse = {
  /** deep copy with edits applied; removed assignments are filtered out */
  course: Course;
  /** removed real assignments, kept so they can be restored individually */
  removed: Assignment[];
};

/** Applies a scenario to a deep copy of the course. The real course is never mutated. */
export function applyScenario(real: Course, scenario: Scenario): AppliedCourse {
  const s = pruneScenario(real, scenario);
  const copy = deepCopyCourse(real);
  const removedSet = new Set(s.removed);
  const removed: Assignment[] = [];
  const assignments: Assignment[] = [];

  for (const a of copy.assignments) {
    const edit = s.edits[a.id];
    const cat = s.categoryChanges[a.id];
    let next = a;
    if (edit) {
      next = {
        ...next,
        score: edit.score,
        possible: edit.possible,
        status: edit.score === null ? "ungraded" : "graded",
        isEdited: true,
      };
    }
    if (cat !== undefined && cat !== a.category) next = { ...next, category: cat, isEdited: true };
    if (removedSet.has(a.id)) removed.push(next);
    else assignments.push(next);
  }

  for (const a of s.added) assignments.unshift({ ...structuredClone(a), isHypothetical: true });

  if (s.weights && Object.keys(s.weights).length > 0) {
    const w = s.weights;
    const names = copy.categories.map((c) => c.name);
    for (const a of copy.assignments) if (!names.includes(a.category)) names.push(a.category);
    copy.categories = names.map((name) => ({
      name,
      weight: w[name] ?? copy.categories.find((c) => c.name === name)?.weight ?? 0,
    }));
    // Entering weights for a points-based class (district didn't send weights) makes it weighted.
    copy.weighted = true;
  }

  copy.assignments = assignments;
  return { course: copy, removed };
}

// Scenario operations (SRD: editScore, addAssignment, removeAssignment, changeCategory, reset).
// Each returns a new Scenario; none mutate their input.

export function editScore(s: Scenario, id: string, score: number | null, possible: number): Scenario {
  if (id.startsWith("h-")) {
    return {
      ...s,
      added: s.added.map((a) =>
        a.id === id ? { ...a, score, possible, status: score === null ? "ungraded" : "graded" } : a,
      ),
    };
  }
  return { ...s, edits: { ...s.edits, [id]: { score, possible } } };
}

/** Undo a score edit on a real assignment. */
export function revertEdit(s: Scenario, id: string): Scenario {
  const edits = { ...s.edits };
  delete edits[id];
  const categoryChanges = { ...s.categoryChanges };
  delete categoryChanges[id];
  return { ...s, edits, categoryChanges };
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function addAssignment(
  s: Scenario,
  input: { name: string; category: string; score: number | null; possible: number; date?: string },
): Scenario {
  const a: Assignment = {
    id: `h-${uuid()}`,
    name: input.name.trim() || "Hypothetical assignment",
    category: input.category,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    score: input.score,
    possible: input.possible,
    status: input.score === null ? "ungraded" : "graded",
    isHypothetical: true,
  };
  return { ...s, added: [a, ...s.added] };
}

export function removeAssignment(s: Scenario, id: string): Scenario {
  if (id.startsWith("h-")) return { ...s, added: s.added.filter((a) => a.id !== id) };
  if (s.removed.includes(id)) return s;
  return { ...s, removed: [...s.removed, id] };
}

export function restoreAssignment(s: Scenario, id: string): Scenario {
  return { ...s, removed: s.removed.filter((r) => r !== id) };
}

export function changeCategory(s: Scenario, id: string, category: string): Scenario {
  if (id.startsWith("h-")) {
    return { ...s, added: s.added.map((a) => (a.id === id ? { ...a, category } : a)) };
  }
  return { ...s, categoryChanges: { ...s.categoryChanges, [id]: category } };
}

export function setWeight(s: Scenario, category: string, weight: number): Scenario {
  return { ...s, weights: { ...(s.weights ?? {}), [category]: weight } };
}

export function setWeights(s: Scenario, weights: Record<string, number>): Scenario {
  return { ...s, weights: { ...(s.weights ?? {}), ...weights } };
}

export function clearWeights(s: Scenario): Scenario {
  const next = { ...s };
  delete next.weights;
  return next;
}

export function reset(): Scenario {
  return emptyScenario();
}
