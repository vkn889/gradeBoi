"use client";

import type { CourseLevel } from "@/lib/types";
import { DEFAULT_SCALE, type GradeScale, type Rounding } from "@/lib/grades/scale";
import { DEFAULT_BONUS, type GpaBonus } from "@/lib/grades/gpa";
import type { Scenario } from "@/lib/grades/hypothetical";

// localStorage keys (SRD "Client storage"). The password is never stored.
export const PREFS_KEY = "gb:prefs";
export const SEEN_KEY = "gb:seen";
export const SCENARIOS_KEY = "gb:scenarios";
export const HISTORY_KEY = "gb:history";
export const AP_KEY = "gb:ap";

export type Prefs = {
  districtUrl: string;
  districtName: string;
  username: string;
  remember: boolean;
  scale: GradeScale;
  rounding: Rounding;
  bonus: GpaBonus;
  /** course id -> level */
  levelOverrides: Record<string, CourseLevel>;
  /** target GPA for the planner */
  gpaGoal: number | null;
  /** course id -> target letter (GPA planner) */
  targetLetters: Record<string, string>;
  /** count this grading period's classes in the cumulative GPA */
  includeCurrent: boolean;
  /** credits each current class is worth in the cumulative GPA (one semester = 0.5) */
  currentCredits: number;
  /** "auto": past years come from the StudentVUE transcript; "manual": from classes typed in */
  gpaSource: "auto" | "manual";
};

export type ApScoreValue = 1 | 2 | 3 | 4 | 5;

/** AP exam scores and the college whose credit the student is checking (saved on the device). */
export type ApState = {
  /** exam id -> score the student got or expects */
  scores: Record<string, ApScoreValue>;
  /** AP exam ids added by hand, on top of those detected from the transcript/gradebook */
  manualExams: string[];
  /** selected college id for the credit estimate */
  college: string | null;
};

export const DEFAULT_AP: ApState = { scores: {}, manualExams: [], college: null };

export type GradeLevel = 9 | 10 | 11 | 12;

/** A finished class from a past term, entered by the student (StudentVUE's API has no course history). */
export type PastCourse = {
  id: string;
  gradeLevel: GradeLevel;
  term: "S1" | "S2" | "Year";
  name: string;
  letter: import("@/lib/grades/scale").Letter;
  level: CourseLevel;
  credits: number;
};

/** Per course key ("<reportPeriod>|<courseId>"): hypothetical toggle plus named saved scenarios. */
export type CourseScenarios = {
  enabled: boolean;
  active: string;
  saved: Record<string, Scenario>;
};
export type ScenarioStore = Record<string, CourseScenarios>;

/** "<reportPeriod>|<courseId>" -> graded assignment ids already seen */
export type SeenStore = Record<string, string[]>;

export function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): the app keeps working in memory.
  }
}

export function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const DEFAULT_PREFS: Prefs = {
  districtUrl: "https://wa-nor-psv.edupoint.com",
  districtName: "Northshore School District",
  username: "",
  remember: true,
  scale: DEFAULT_SCALE,
  rounding: "none",
  bonus: DEFAULT_BONUS,
  levelOverrides: {},
  gpaGoal: null,
  targetLetters: {},
  includeCurrent: true,
  currentCredits: 0.5,
  gpaSource: "auto",
};

/** Reads prefs, filling in defaults for missing or malformed fields. */
export function readPrefs(): Prefs {
  const raw = read<Partial<Prefs> & { password?: unknown }>(PREFS_KEY, {});
  const p: Prefs = { ...DEFAULT_PREFS, ...raw, scale: { ...DEFAULT_SCALE, ...(raw.scale ?? {}) }, bonus: { ...DEFAULT_BONUS, ...(raw.bonus ?? {}) } };
  // Defensive: never keep anything that looks like a password.
  delete (p as Record<string, unknown>).password;
  return p;
}
