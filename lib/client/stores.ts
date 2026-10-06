"use client";

import { createLocalStore } from "./local-store";
import {
  DEFAULT_PREFS,
  AP_KEY,
  DEFAULT_AP,
  HISTORY_KEY,
  PREFS_KEY,
  SCENARIOS_KEY,
  SEEN_KEY,
  readPrefs,
  type ApState,
  type PastCourse,
  type Prefs,
  type ScenarioStore,
  type SeenStore,
} from "./storage";

export const prefsStore = createLocalStore<Prefs>(PREFS_KEY, DEFAULT_PREFS, () => readPrefs());
export const seenStore = createLocalStore<SeenStore>(SEEN_KEY, {}, (raw) =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as SeenStore) : {},
);
export const scenarioStore = createLocalStore<ScenarioStore>(SCENARIOS_KEY, {}, (raw) =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ScenarioStore) : {},
);

export const historyStore = createLocalStore<PastCourse[]>(HISTORY_KEY, [], (raw) =>
  Array.isArray(raw)
    ? (raw as PastCourse[]).filter(
        (c) => c && typeof c.id === "string" && typeof c.letter === "string" && typeof c.credits === "number",
      )
    : [],
);

export const apStore = createLocalStore<ApState>(AP_KEY, DEFAULT_AP, (raw) => {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Partial<ApState>) : {};
  return {
    scores: v.scores && typeof v.scores === "object" ? (v.scores as ApState["scores"]) : {},
    manualExams: Array.isArray(v.manualExams) ? v.manualExams.filter((x) => typeof x === "string") : [],
    college: typeof v.college === "string" ? v.college : null,
  };
});

export function updatePrefs(patch: Partial<Prefs>) {
  prefsStore.set((p) => ({ ...p, ...patch }));
}

export const usePrefs = () => prefsStore.useValue();
