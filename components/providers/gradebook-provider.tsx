"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ApiError, Gradebook } from "@/lib/types";
import { historyStore, prefsStore, scenarioStore, seenStore } from "@/lib/client/stores";
import {
  DEFAULT_SCENARIO_NAME,
  buildCourseView,
  cumulativeGpaFor,
  gpaFor,
  gradedIds,
  scenarioKey,
  type CourseView,
} from "@/lib/client/course-view";
import type { GpaResult } from "@/lib/grades/gpa";
import type { TranscriptResponse } from "@/lib/transcript/types";
import type { CumulativeResult, TranscriptGpa } from "@/lib/client/course-view";
import { detectExams } from "@/lib/ap/detect";
import { emptyScenario, isEmptyScenario, type Scenario } from "@/lib/grades/hypothetical";
import type { CourseScenarios } from "@/lib/client/storage";

type Status = "loading" | "ready" | "error";

type GradebookContextValue = {
  studentName: string;
  demo: boolean;
  status: Status;
  error: ApiError["error"] | null;
  gradebook: Gradebook | null;
  /** grading period being shown */
  period: number | null;
  /** true while a refresh runs with data already on screen */
  refreshing: boolean;
  load: (period?: number) => Promise<void>;
  views: CourseView[];
  /** this grading period only */
  gpa: GpaResult;
  realGpa: GpaResult;
  /** all of high school: past years + this grading period */
  cumulative: CumulativeResult;
  realCumulative: CumulativeResult;
  /** unofficial transcript read from StudentVUE documents (null while loading) */
  transcript: TranscriptState;
  reloadTranscript: () => Promise<void>;
  /** number of past-year grades entered */
  historyCount: number;
  /** AP exam ids detected from the transcript and this term's classes */
  detectedApExams: string[];
  anyHypothetical: boolean;
  markSeen: (courseId: string) => void;
  logout: () => Promise<void>;
};

export type TranscriptState = { status: "LOADING" } | { status: "ERROR"; message: string } | TranscriptResponse;

const GradebookContext = React.createContext<GradebookContextValue | null>(null);

export function useGradebook() {
  const ctx = React.useContext(GradebookContext);
  if (!ctx) throw new Error("useGradebook must be used inside GradebookProvider");
  return ctx;
}

export function GradebookProvider({
  studentName,
  demo,
  children,
}: {
  studentName: string;
  demo: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [gradebook, setGradebook] = React.useState<Gradebook | null>(null);
  const [period, setPeriod] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<Status>("loading");
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<ApiError["error"] | null>(null);
  const requestId = React.useRef(0);
  const gradebookRef = React.useRef<Gradebook | null>(null);
  // StudentVUE reports whichever period was requested as "current", so remember the real
  // current period from the first load (made without a reportPeriod).
  const currentPeriodRef = React.useRef<number | null>(null);

  const prefs = prefsStore.useValue();
  const scenarios = scenarioStore.useValue();
  const seen = seenStore.useValue();
  const history = historyStore.useValue();
  const [transcript, setTranscript] = React.useState<TranscriptState>({ status: "LOADING" });
  const transcriptRequested = React.useRef(false);

  const load = React.useCallback(
    async (reportPeriod?: number) => {
      const id = ++requestId.current;
      setError(null);
      setRefreshing(true);
      if (!gradebookRef.current) setStatus("loading");
      try {
        const res = await fetch("/api/gradebook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reportPeriod === undefined ? {} : { reportPeriod }),
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as Gradebook | ApiError | null;
        if (id !== requestId.current) return;
        if (!res.ok || !body || "error" in body) {
          const err =
            body && "error" in body
              ? body.error
              : { code: "NETWORK", message: "Couldn't load your grades. Check your connection and try again." };
          if (res.status === 401) {
            router.replace("/?expired=1");
            return;
          }
          setError(err);
          setStatus(gradebookRef.current ? "ready" : "error");
          return;
        }
        if (reportPeriod === undefined) currentPeriodRef.current = body.currentPeriod;
        const shownPeriod = reportPeriod ?? body.currentPeriod;
        const gb: Gradebook = { ...body, currentPeriod: currentPeriodRef.current ?? body.currentPeriod };
        // First visit for a course in a period: everything currently graded counts as seen.
        seenStore.set((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const c of gb.courses) {
            const key = scenarioKey(shownPeriod, c.id);
            if (!next[key]) {
              next[key] = gradedIds(c);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        gradebookRef.current = gb;
        setGradebook(gb);
        setPeriod(shownPeriod);
        setStatus("ready");
      } catch {
        if (id !== requestId.current) return;
        setError({ code: "NETWORK", message: "Couldn't reach GradeBoi. Check your connection and try again." });
        setStatus(gradebookRef.current ? "ready" : "error");
      } finally {
        if (id === requestId.current) setRefreshing(false);
      }
    },
    [router],
  );

  React.useEffect(() => {
    // Deferred so the fetch starts after commit; cancelled on StrictMode's dev re-mount.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reloadTranscript = React.useCallback(async () => {
    setTranscript({ status: "LOADING" });
    try {
      const res = await fetch("/api/transcript", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as TranscriptResponse | { error: { message: string } } | null;
      if (res.status === 401) {
        router.replace("/?expired=1");
        return;
      }
      if (!res.ok || !body || "error" in body) {
        setTranscript({ status: "ERROR", message: body && "error" in body ? body.error.message : "Couldn't read your transcript." });
        return;
      }
      setTranscript(body);
    } catch {
      setTranscript({ status: "ERROR", message: "Couldn't reach GradeBoi to read your transcript." });
    }
  }, [router]);

  // Read the transcript once, after grades are on screen, so it never delays the dashboard.
  React.useEffect(() => {
    if (status !== "ready" || transcriptRequested.current) return;
    transcriptRequested.current = true;
    queueMicrotask(() => void reloadTranscript());
  }, [status, reloadTranscript]);

  const transcriptGpa = React.useMemo<TranscriptGpa | null>(() => {
    if (transcript.status !== "FOUND") return null;
    const t = transcript.transcript;
    return {
      unweighted: t.gpa.unweighted,
      weighted: t.gpa.weighted,
      credits: t.gpa.credits,
      courses: t.courses.map((c) => ({ letter: c.letter, level: c.level, credits: c.credits })),
    };
  }, [transcript]);

  const views = React.useMemo(() => {
    if (!gradebook || period === null) return [];
    return gradebook.courses.map((c) => buildCourseView(c, period, prefs, scenarios, seen));
  }, [gradebook, period, prefs, scenarios, seen]);

  const gpa = React.useMemo(() => gpaFor(views, prefs, "effective"), [views, prefs]);
  const realGpa = React.useMemo(() => gpaFor(views, prefs, "real"), [views, prefs]);
  const cumulative = React.useMemo(
    () => cumulativeGpaFor(views, history, prefs, "effective", transcriptGpa),
    [views, history, prefs, transcriptGpa],
  );
  const realCumulative = React.useMemo(
    () => cumulativeGpaFor(views, history, prefs, "real", transcriptGpa),
    [views, history, prefs, transcriptGpa],
  );
  const anyHypothetical = views.some((v) => v.hypoEnabled && !isEmptyScenario(v.scenario));
  const detectedApExams = React.useMemo(() => {
    const fromTranscript = transcript.status === "FOUND" ? transcript.transcript.apExamIds : [];
    const fromViews = detectExams(views.map((v) => v.course.title));
    return Array.from(new Set([...fromTranscript, ...fromViews]));
  }, [transcript, views]);

  const markSeen = React.useCallback(
    (courseId: string) => {
      const course = gradebookRef.current?.courses.find((c) => c.id === courseId);
      if (!course || period === null) return;
      const key = scenarioKey(period, courseId);
      seenStore.set((prev) => {
        const existing = new Set(prev[key] ?? []);
        const fresh = gradedIds(course).filter((id) => !existing.has(id));
        if (prev[key] && fresh.length === 0) return prev;
        return { ...prev, [key]: [...existing, ...fresh].slice(-2000) };
      });
    },
    [period],
  );

  const logout = React.useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      // Full navigation drops every in-memory grade and any cached dashboard render.
      gradebookRef.current = null;
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  }, []);

  const value: GradebookContextValue = {
    studentName,
    demo,
    status,
    error,
    gradebook,
    period,
    refreshing,
    load,
    views,
    gpa,
    realGpa,
    cumulative,
    realCumulative,
    historyCount: history.length,
    detectedApExams,
    transcript,
    reloadTranscript,
    anyHypothetical,
    markSeen,
    logout,
  };

  return <GradebookContext.Provider value={value}>{children}</GradebookContext.Provider>;
}

/** Scenario state + operations for one course (persisted per course in gb:scenarios). */
export function useCourseScenario(view: CourseView | undefined) {
  const key = view?.key;

  const update = React.useCallback(
    (fn: (entry: CourseScenarios) => CourseScenarios) => {
      if (!key) return;
      scenarioStore.set((prev) => {
        const entry: CourseScenarios = prev[key] ?? {
          enabled: false,
          active: DEFAULT_SCENARIO_NAME,
          saved: { [DEFAULT_SCENARIO_NAME]: emptyScenario() },
        };
        return { ...prev, [key]: fn(entry) };
      });
    },
    [key],
  );

  const edit = React.useCallback(
    (fn: (s: Scenario) => Scenario) =>
      update((entry) => {
        const name = entry.active in entry.saved ? entry.active : DEFAULT_SCENARIO_NAME;
        const current = entry.saved[name] ?? emptyScenario();
        return { ...entry, active: name, saved: { ...entry.saved, [name]: fn(current) } };
      }),
    [update],
  );

  const setEnabled = React.useCallback((enabled: boolean) => update((e) => ({ ...e, enabled })), [update]);

  const reset = React.useCallback(() => edit(() => emptyScenario()), [edit]);

  const select = React.useCallback(
    (name: string) => update((e) => ({ ...e, active: name, saved: { ...e.saved, [name]: e.saved[name] ?? emptyScenario() } })),
    [update],
  );

  /** Saves the current edits under a new name and switches to it. */
  const saveAs = React.useCallback(
    (name: string) =>
      update((e) => {
        const current = e.saved[e.active] ?? emptyScenario();
        return { ...e, active: name, saved: { ...e.saved, [name]: structuredClone(current) } };
      }),
    [update],
  );

  const createBlank = React.useCallback(
    (name: string) => update((e) => ({ ...e, active: name, saved: { ...e.saved, [name]: emptyScenario() } })),
    [update],
  );

  const removeScenario = React.useCallback(
    (name: string) =>
      update((e) => {
        const saved = { ...e.saved };
        delete saved[name];
        if (Object.keys(saved).length === 0) saved[DEFAULT_SCENARIO_NAME] = emptyScenario();
        const active = e.active === name ? Object.keys(saved)[0] : e.active;
        return { ...e, active, saved };
      }),
    [update],
  );

  return { edit, setEnabled, reset, select, saveAs, createBlank, removeScenario };
}

export function useScenarioNames(key: string | undefined): string[] {
  const store = scenarioStore.useValue();
  if (!key) return [];
  const entry = store[key];
  return entry ? Object.keys(entry.saved) : [DEFAULT_SCENARIO_NAME];
}
