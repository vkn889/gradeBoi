import type { CourseLevel } from "@/lib/types";
import { GPA_POINTS, detectLevel } from "@/lib/grades/gpa";
import type { Letter } from "@/lib/grades/scale";
import { detectExams } from "@/lib/ap/detect";

// Reads an unofficial transcript's text (already split into lines of table cells) and pulls out
// the GPA printed on it, the credits behind it, and, when possible, the individual classes.
// Transcript layouts vary by district, so every rule here is a tolerant heuristic, and the
// parsed classes are only trusted when they reproduce the GPA printed on the transcript.

/** One visual line of the PDF; `cells` are runs of text separated by a visible gap. */
export type TranscriptLine = { text: string; cells: string[] };

export type TranscriptCourse = {
  gradeLevel: number | null;
  schoolYear: string | null;
  term: string | null;
  name: string;
  letter: Letter;
  level: CourseLevel;
  credits: number;
};

export type TranscriptSummary = {
  /** GPA exactly as printed on the transcript */
  printed: {
    unweighted: number | null;
    weighted: number | null;
    /** a GPA printed without saying weighted/unweighted */
    unlabeled: number | null;
    /** credits the GPA is based on (attempted/GPA credits, else earned) */
    credits: number | null;
  };
  courses: TranscriptCourse[];
  /** the parsed classes reproduce the printed GPA, so they can be trusted */
  coursesVerified: boolean;
  /** best numbers to use for the cumulative GPA */
  gpa: { unweighted: number | null; weighted: number | null; credits: number | null };
  /** human-readable list of what was found, for the UI */
  notes: string[];
  /** AP exam ids detected anywhere on the transcript (for the AP credit estimate) */
  apExamIds: string[];
};

const GPA_RE = /\bG\.?\s?P\.?\s?A\b/i;
const GPA_NUM = /(?:^|[^\d.])([0-5]\.\d{1,4})(?![\d.])/g;
const CREDIT_NUM = /(?:^|[^\d.])(\d{1,3}(?:\.\d{1,4})?)(?![\d.])/g;
const MARK_RE = /^(A\+?|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-|F|E)$/;
const TERM_RE = /^(S[12]|Sem(?:ester)?\s*[12]|T[1-3]|Tri(?:mester)?\s*[1-3]|Q[1-4]|FY|Year|Full Year)$/i;
const YEAR_RE = /\b(20\d\d)\s*[-/]\s*(20)?(\d\d)\b/;
const GRADE_RE = /\b(?:Grade|Gr\.?)\s*:?\s*0?(9|10|11|12)\b|\b(9|10|11|12)(?:th)\s+Grade\b/i;

type Kind = "weighted" | "unweighted" | "unlabeled";

function gpaKind(label: string): Kind {
  if (/un-?\s?weighted|\bunwt\b|\bunw\b|\bnon-?weighted\b/i.test(label)) return "unweighted";
  if (/weighted|\bwtd\b|\bwt\b/i.test(label)) return "weighted";
  return "unlabeled";
}

/** Cumulative GPAs beat unlabeled ones, which beat per-term/per-year GPAs. */
function gpaScore(label: string): number {
  if (/\bcum(ulative|\.)?\b|\boverall\b|\btotal\b|\bcareer\b/i.test(label)) return 2;
  if (/\bterm\b|\bsem(ester)?\b|\bS[12]\b|\byear\b|\bannual\b|\bQ[1-4]\b|\bperiod\b/i.test(label)) return -2;
  return 0;
}

function numbersIn(text: string, re: RegExp): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(re)) out.push(Number(m[1]));
  return out;
}

type Candidate = { kind: Kind; value: number; score: number; order: number };

/** Finds printed GPA values: "Cumulative GPA: 3.857", label/value cells, or a label row above a value row. */
export function findGpas(lines: TranscriptLine[]): Candidate[] {
  const found: Candidate[] = [];
  let order = 0;
  const add = (label: string, value: number) => {
    if (value < 0 || value > 5.5) return;
    found.push({ kind: gpaKind(label), value, score: gpaScore(label), order: order++ });
  };

  lines.forEach((line, li) => {
    if (!GPA_RE.test(line.text)) return;
    const cells = line.cells.length ? line.cells : [line.text];
    const labelCells = cells.map((c, i) => ({ c, i })).filter(({ c }) => GPA_RE.test(c));
    let matchedInline = false;

    for (const { c, i } of labelCells) {
      // Value inside the label cell ("Cumulative GPA: 3.857") ...
      const inCell = numbersIn(c.replace(GPA_RE, " "), GPA_NUM);
      if (inCell.length) {
        add(c, inCell[0]);
        matchedInline = true;
        continue;
      }
      // ... or in the next cell(s) on the same line ("Weighted GPA | 4.012").
      for (let j = i + 1; j < cells.length && j <= i + 2; j++) {
        if (GPA_RE.test(cells[j])) break;
        const n = numbersIn(cells[j], GPA_NUM);
        if (n.length) {
          add(c, n[0]);
          matchedInline = true;
          break;
        }
      }
    }

    // Table form: a header row of labels, values on the next row in the same column order.
    if (!matchedInline && labelCells.length) {
      const next = lines[li + 1];
      if (!next) return;
      const headerCells = cells;
      const valueCells = next.cells.length ? next.cells : [next.text];
      if (valueCells.length === headerCells.length) {
        headerCells.forEach((h, k) => {
          if (!GPA_RE.test(h)) return;
          const n = numbersIn(valueCells[k], GPA_NUM);
          if (n.length) add(h, n[0]);
        });
      } else {
        const values = numbersIn(next.text, GPA_NUM);
        if (labelCells.length === 1 && values.length >= 1) add(labelCells[0].c, values[0]);
      }
    }
  });
  return found;
}

/** Credits behind the GPA: prefers GPA/attempted credits, then earned/total. */
export function findCredits(lines: TranscriptLine[]): number | null {
  type C = { value: number; score: number };
  const found: C[] = [];
  const score = (label: string) =>
    (/\bgpa\b/i.test(label) ? 3 : 0) +
    (/attempt/i.test(label) ? 2 : 0) +
    (/earn|total|cum/i.test(label) ? 1 : 0) -
    (/term|sem|year|req/i.test(label) ? 3 : 0);

  lines.forEach((line, li) => {
    if (!/credit/i.test(line.text)) return;
    const cells = line.cells.length ? line.cells : [line.text];
    let matched = false;
    cells.forEach((c, i) => {
      if (!/credit/i.test(c)) return;
      const inCell = numbersIn(c.replace(/[^:]*credits?/i, " "), CREDIT_NUM);
      if (inCell.length) {
        found.push({ value: inCell[0], score: score(c) });
        matched = true;
        return;
      }
      const n = cells[i + 1] ? numbersIn(cells[i + 1], CREDIT_NUM) : [];
      if (n.length && !/credit|gpa/i.test(cells[i + 1])) {
        found.push({ value: n[0], score: score(c) });
        matched = true;
      }
    });
    if (!matched) {
      const next = lines[li + 1];
      if (next && next.cells.length === cells.length) {
        cells.forEach((h, k) => {
          if (!/credit/i.test(h)) return;
          const n = numbersIn(next.cells[k], CREDIT_NUM);
          if (n.length) found.push({ value: n[0], score: score(h) });
        });
      }
    }
  });
  const plausible = found.filter((f) => f.value > 0 && f.value <= 60);
  if (!plausible.length) return null;
  plausible.sort((a, b) => b.score - a.score || b.value - a.value);
  return plausible[0].value;
}

/** Class rows: a course name, a letter mark, and a credit value, with grade/year/term context. */
export function findCourses(lines: TranscriptLine[]): TranscriptCourse[] {
  const out: TranscriptCourse[] = [];
  let gradeLevel: number | null = null;
  let schoolYear: string | null = null;
  let term: string | null = null;

  for (const line of lines) {
    const cells = (line.cells.length ? line.cells : line.text.split(/\s{2,}/)).map((c) => c.trim()).filter(Boolean);
    const g = GRADE_RE.exec(line.text);
    const y = YEAR_RE.exec(line.text);
    const markIdx = cells.findIndex((c) => MARK_RE.test(c));

    if (markIdx === -1) {
      // Context lines ("Grade 10   2025-2026", "Semester 1").
      if (g) gradeLevel = Number(g[1] ?? g[2]);
      if (y) schoolYear = `${y[1]}-${y[2] ?? "20"}${y[3]}`;
      const t = cells.find((c) => TERM_RE.test(c));
      if (t && cells.length <= 3) term = t;
      continue;
    }
    if (GPA_RE.test(line.text) || /credit/i.test(line.text)) continue;

    const mark = cells[markIdx].toUpperCase();
    const creditCell = cells.slice(markIdx + 1).find((c) => /^\d{1,2}(\.\d{1,4})?$/.test(c));
    const credits = creditCell ? Number(creditCell) : NaN;
    if (!(credits > 0 && credits <= 2)) continue;

    const rowTerm = cells.find((c) => TERM_RE.test(c)) ?? term;
    const name = cells
      .slice(0, markIdx)
      .filter((c) => !TERM_RE.test(c) && !/^\d{1,2}$/.test(c) && !YEAR_RE.test(c) && /[A-Za-z]{2}/.test(c))
      .sort((a, b) => b.length - a.length)[0];
    if (!name) continue;

    // D- and E don't exist on a 4-point scale with these letters; treat E as F, D- as D.
    const letter = (mark === "E" ? "F" : mark === "D-" ? "D" : mark === "A+" ? "A" : mark) as Letter;
    if (!(letter in GPA_POINTS)) continue;

    out.push({
      gradeLevel: g ? Number(g[1] ?? g[2]) : gradeLevel,
      schoolYear,
      term: rowTerm ? normalizeTerm(rowTerm) : null,
      name: name.replace(/\s+/g, " "),
      letter,
      level: detectLevel(name),
      credits,
    });
  }
  return out;
}

function normalizeTerm(t: string): string {
  const s = t.replace(/\s+/g, " ").trim();
  const m = /^(?:S|Sem(?:ester)?)\s*([12])$/i.exec(s);
  if (m) return `S${m[1]}`;
  if (/^(FY|Year|Full Year)$/i.test(s)) return "Year";
  return s.toUpperCase();
}

function coursesGpa(courses: TranscriptCourse[]) {
  let u = 0;
  let cr = 0;
  for (const c of courses) {
    u += GPA_POINTS[c.letter] * c.credits;
    cr += c.credits;
  }
  return cr > 0 ? { unweighted: u / cr, credits: cr } : null;
}

const VERIFY_TOLERANCE = 0.015;

const ALL_NUMS = /\d+(?:\.\d+)?/g;

/**
 * Washington / Synergy transcripts print the real GPA on a "Cumulative" row of the
 * "Report Period and Cumulative Summary" table, with no "GPA" word on that row — the GPA is the
 * rightmost number. Columns are Cred Earn · Cred Attp · GPA Earn · GPA Attp · GPA Pts · GPA, so the
 * credits the GPA is averaged over come out as (GPA points / GPA) when the row has enough numbers.
 * Example: "Cumulative 29.250 29.250 28.500 28.500 113.850 3.995" -> gpa 3.995, credits 28.5.
 */
export function findCumulativeRow(lines: TranscriptLine[]): { gpa: number; credits: number | null } | null {
  const candidates: { gpa: number; credits: number | null; score: number }[] = [];
  for (const line of lines) {
    const first = (line.cells[0] ?? line.text).trim();
    // The row starts with Cumulative/Career/Overall/Total; skip the section header, which has no numbers.
    if (!/^(cumulative|career|overall|total)\b/i.test(first)) continue;
    if (/summary/i.test(line.text) && !/\d/.test(line.text)) continue;
    const nums = (line.text.match(ALL_NUMS) ?? []).map(Number).filter((n) => Number.isFinite(n));
    if (!nums.length) continue;
    const gpa = nums[nums.length - 1];
    // A GPA is 0–5; anything larger means the GPA column wasn't the last number on this row.
    if (gpa < 0 || gpa > 5) continue;
    let credits: number | null = null;
    if (nums.length >= 2 && gpa > 0.05) {
      const pts = nums[nums.length - 2];
      const derived = pts / gpa;
      if (derived > 0 && derived <= 400) credits = Math.round(derived * 100) / 100;
    }
    candidates.push({ gpa, credits, score: /cumulative/i.test(first) ? 2 : /career|overall/i.test(first) ? 1 : 0 });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { gpa: candidates[0].gpa, credits: candidates[0].credits };
}

export function summarizeTranscript(lines: TranscriptLine[]): TranscriptSummary {
  const gpas = findGpas(lines);
  // Highest-scoring (cumulative over per-term) GPA of each kind, first one on ties.
  const best = (kind: Kind) =>
    gpas.filter((g) => g.kind === kind).sort((a, b) => b.score - a.score || a.order - b.order)[0]?.value ?? null;
  // A labeled "Cumulative" row (Washington/Synergy transcripts) is the most reliable GPA, and it
  // is unweighted on a 4.0 scale, so it wins the unweighted and credit slots.
  const cumRow = findCumulativeRow(lines);
  const printed = {
    unweighted: cumRow?.gpa ?? best("unweighted"),
    weighted: best("weighted"),
    unlabeled: best("unlabeled"),
    credits: cumRow?.credits ?? findCredits(lines),
  };

  const courses = findCourses(lines);
  const fromCourses = courses.length >= 3 ? coursesGpa(courses) : null;
  const reference = printed.unweighted ?? printed.unlabeled;
  const coursesVerified =
    fromCourses !== null && reference !== null && Math.abs(fromCourses.unweighted - reference) <= VERIFY_TOLERANCE;

  // The printed GPA is the source of truth; parsed classes only fill gaps when verified.
  const unweighted = printed.unweighted ?? printed.unlabeled ?? (coursesVerified ? fromCourses!.unweighted : null);
  const credits = printed.credits ?? (coursesVerified ? fromCourses!.credits : null);

  const notes: string[] = [];
  if (printed.unweighted !== null) notes.push(`Unweighted GPA ${printed.unweighted}`);
  if (printed.weighted !== null) notes.push(`Weighted GPA ${printed.weighted}`);
  if (printed.unlabeled !== null && printed.unweighted === null) notes.push(`GPA ${printed.unlabeled}`);
  if (credits !== null) notes.push(`${credits} credits`);
  if (courses.length) notes.push(`${courses.length} classes${coursesVerified ? " (match the printed GPA)" : ""}`);

  const apExamIds = detectExams(lines.map((l) => l.text));

  return {
    printed,
    courses: coursesVerified ? courses : [],
    coursesVerified,
    gpa: { unweighted, weighted: printed.weighted, credits },
    notes,
    apExamIds,
  };
}
