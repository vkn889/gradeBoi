"use client";

import { createLocalStore } from "./local-store";
import {
  DEFAULT_PREFS,
  PREFS_KEY,
  SCENARIOS_KEY,
  SEEN_KEY,
  readPrefs,
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

export function updatePrefs(patch: Partial<Prefs>) {
  prefsStore.set((p) => ({ ...p, ...patch }));
}

export const usePrefs = () => prefsStore.useValue();
