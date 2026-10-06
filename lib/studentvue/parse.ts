import { XMLParser } from "fast-xml-parser";
import type { Assignment, AssignmentStatus, Category, Course, Gradebook, ReportPeriod } from "@/lib/types";
import { detectLevel } from "@/lib/grades/gpa";

// Forgiving parser for StudentVUE's Gradebook XML (see SRD "Parsing rules").

const ARRAY_TAGS = new Set([
  "ReportPeriod",
  "Course",
  "Mark",
  "AssignmentGradeCalc",
  "Assignment",
  "DistrictInfo",
]);

export class StudentVueError extends Error {
  constructor(
    public code: "BAD_CREDENTIALS" | "UPSTREAM_ERROR" | "MALFORMED" | "DEPRECATED" | "NOT_SUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "StudentVueError";
  }
}

export function createXmlParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    // Gradebooks contain thousands of escaped characters; raise the expansion caps
    // (they exist to stop DOCTYPE entity bombs, which these limits still bound).
    processEntities: {
      enabled: true,
      maxTotalExpansions: 5_000_000,
      maxExpandedLength: 50_000_000,
    },
    isArray: (tagName) => ARRAY_TAGS.has(tagName),
  });
}

type Attrs = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

/** Parses "8.00", "92.5%", "1,000" etc. Returns null when not a finite number. */
export function num(v: unknown): number | null {
  const s = str(v).replace(/[,%\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Decodes the five XML entities plus numeric character references. */
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e: string) => {
    const lower = e.toLowerCase();
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "amp") return "&";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const code = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

const RESULT_RE = /<(?:[\w-]+:)?ProcessWebServiceRequestResult(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?ProcessWebServiceRequestResult>/;
const FAULT_RE = /<(?:[\w-]+:)?faultstring(?:\s[^>]*)?>([\s\S]*?)<\//;

/**
 * Unwraps the SOAP envelope and returns the inner XML string. The result element holds
 * escaped XML, so it is decoded here and parsed a second time by the caller.
 */
export function extractSoapResult(envelopeXml: string): string {
  const m = RESULT_RE.exec(envelopeXml);
  if (!m || m[1].trim() === "") {
    if (FAULT_RE.test(envelopeXml)) throw new StudentVueError("UPSTREAM_ERROR", "StudentVUE returned an error.");
    if (!/<(?:[\w-]+:)?Envelope/.test(envelopeXml)) {
      throw new StudentVueError("MALFORMED", "Could not read the response from StudentVUE.");
    }
    throw new StudentVueError("UPSTREAM_ERROR", "StudentVUE returned an empty response.");
  }
  const body = m[1].trim();
  // Some servers wrap the payload in CDATA instead of escaping it.
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(body);
  return cdata ? cdata[1] : decodeXmlEntities(body);
}

/** Depth-first search for a key anywhere in a parsed document (namespaced tags vary). */
function findKey(node: unknown, key: string): unknown {
  if (node === null || typeof node !== "object") return undefined;
  for (const [k, v] of Object.entries(node as Attrs)) {
    const local = k.includes(":") ? k.split(":").pop() : k;
    if (local === key) return v;
  }
  for (const v of Object.values(node as Attrs)) {
    const found = findKey(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Parses the inner result XML and throws on RT_ERROR (a bad login returns HTTP 200 with RT_ERROR). */
export function parseInner(innerXml: string): Attrs {
  const parser = createXmlParser();
  let doc: Attrs;
  try {
    doc = parser.parse(innerXml) as Attrs;
  } catch {
    throw new StudentVueError("MALFORMED", "Could not read the gradebook from StudentVUE.");
  }
  const rt = doc.RT_ERROR as Attrs | undefined;
  if (rt) {
    const message = str(rt.ERROR_MESSAGE) || "StudentVUE returned an error.";
    // Synergy 2027 answers every legacy SOAP data call with "This app is deprecated" (D5518).
    if (isDeprecationError(message)) throw new StudentVueError("DEPRECATED", message);
    if (isCredentialError(message)) throw new StudentVueError("BAD_CREDENTIALS", "Incorrect username or password.");
    throw new StudentVueError("UPSTREAM_ERROR", message);
  }
  return doc;
}

export function isDeprecationError(message: string): boolean {
  return /deprecated|D5518|download StudentVUE/i.test(message);
}

export function isCredentialError(message: string): boolean {
  if (isDeprecationError(message)) return false;
  return /invalid user|password|incorrect|user ?id|login|credential|not authorized|account/i.test(message);
}

// --- Assignment parsing ---------------------------------------------------------------

const POINTS_SLASH = /^\s*(-?[\d.,]+)\s*\/\s*(-?[\d.,]+)/;
const POINTS_POSSIBLE = /^\s*(-?[\d.,]+)\s*points?\s*possible/i;
const OUT_OF = /^\s*(-?[\d.,]+)\s*out\s*of\s*(-?[\d.,]+)/i;
const PERCENT_ONLY = /^\s*(-?[\d.,]+)\s*%\s*$/;

export type ParsedScore = { score: number | null; possible: number; status: AssignmentStatus };

/**
 * Applies the SRD parsing rules:
 *  Points="8.00 / 10.0000"           -> 8 / 10 graded
 *  Points="10.0000 Points Possible"  -> null / 10 ungraded
 *  Score="Not Graded" or blank       -> ungraded
 *  Score="Not for Grading"           -> notForGrading
 *  Score="85%" (percent only)        -> 85 / 100
 *  Notes containing Missing / Late   -> missing / late
 */
export function parseScore(rawPoints: string, rawScore: string, notes: string): ParsedScore {
  const points = rawPoints.trim();
  const score = rawScore.trim();
  let result: ParsedScore;

  const slash = POINTS_SLASH.exec(points);
  const possibleOnly = POINTS_POSSIBLE.exec(points);

  if (/not\s*for\s*grading/i.test(score) || /not\s*for\s*grading/i.test(points)) {
    const poss = slash ? num(slash[2]) : possibleOnly ? num(possibleOnly[1]) : null;
    result = { score: null, possible: poss ?? 0, status: "notForGrading" };
  } else if (/excused/i.test(score) || /^\s*ex\s*$/i.test(score)) {
    const poss = slash ? num(slash[2]) : possibleOnly ? num(possibleOnly[1]) : null;
    result = { score: null, possible: poss ?? 0, status: "excused" };
  } else if (slash) {
    result = { score: num(slash[1]), possible: num(slash[2]) ?? 0, status: "graded" };
  } else if (possibleOnly) {
    result = { score: null, possible: num(possibleOnly[1]) ?? 0, status: "ungraded" };
  } else if (OUT_OF.test(score)) {
    const m = OUT_OF.exec(score)!;
    result = { score: num(m[1]), possible: num(m[2]) ?? 0, status: "graded" };
  } else if (PERCENT_ONLY.test(score)) {
    result = { score: num(PERCENT_ONLY.exec(score)![1]), possible: 100, status: "graded" };
  } else {
    // "Not Graded", blank, or something unrecognized: treat as ungraded.
    const poss = num(points);
    result = { score: null, possible: poss ?? 0, status: "ungraded" };
  }

  if (result.score === null && result.status === "graded") result.status = "ungraded";

  if (result.status !== "notForGrading" && result.status !== "excused") {
    if (/missing/i.test(notes)) result.status = "missing";
    else if (/\blate\b/i.test(notes)) result.status = "late";
  }
  return result;
}

function parseWeight(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, n));
}

/** "Smith, Jane" stays as-is; trims whitespace. */
function parseTeacher(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Converts US-style "9/15/2026" to ISO "2026-09-15"; leaves unknown formats as-is. */
export function toIsoDate(raw: string): string {
  const s = raw.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return s;
}

function arr<T = Attrs>(v: unknown): T[] {
  if (v == null || v === "") return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

/** Picks the mark (grading-period column) to read. Most districts send one per course. */
function pickMark(marks: Attrs[]): Attrs | undefined {
  if (marks.length <= 1) return marks[0];
  // Prefer the mark with the most assignments.
  return [...marks].sort(
    (a, b) => arr((b.Assignments as Attrs)?.Assignment).length - arr((a.Assignments as Attrs)?.Assignment).length,
  )[0];
}

function parseCourse(c: Attrs, index: number): Course {
  const period = num(c.Period) ?? index + 1;
  const title = str(c.Title) || str(c.CourseName) || `Course ${index + 1}`;
  const mark = pickMark(arr(c.Marks && (c.Marks as Attrs).Mark));

  const calcRows = arr((mark?.GradeCalculationSummary as Attrs)?.AssignmentGradeCalc).filter(
    (r) => str(r.Type).toUpperCase() !== "TOTAL",
  );

  const categories: Category[] = [];
  for (const r of calcRows) {
    const name = str(r.Type);
    const weight = parseWeight(r.Weight);
    if (!name || categories.some((x) => x.name === name)) continue;
    categories.push({ name, weight: weight ?? 0 });
  }
  const weighted = categories.length > 0 && categories.some((x) => x.weight > 0);

  const assignments: Assignment[] = arr((mark?.Assignments as Attrs)?.Assignment).map((a, i) => {
    const notes = str(a.Notes);
    const parsed = parseScore(str(a.Points), str(a.Score), notes);
    const category = str(a.Type) || "Uncategorized";
    const out: Assignment = {
      id: str(a.GradebookID) || `${period}-${i}`,
      name: str(a.Measure) || "Untitled assignment",
      category,
      date: toIsoDate(str(a.Date)),
      score: parsed.score,
      possible: parsed.possible,
      status: parsed.status,
    };
    const due = str(a.DueDate);
    if (due) out.dueDate = toIsoDate(due);
    if (notes) out.notes = notes;
    return out;
  });

  // Weighted class with assignments in a category the summary didn't list: add it at weight 0.
  if (weighted) {
    for (const a of assignments) {
      if (!categories.some((x) => x.name === a.category)) categories.push({ name: a.category, weight: 0 });
    }
  } else {
    for (const a of assignments) {
      if (!categories.some((x) => x.name === a.category)) categories.push({ name: a.category, weight: 0 });
    }
    for (const cat of categories) cat.weight = 0;
  }

  const officialPercent = num(mark?.CalculatedScoreRaw);
  const officialLetter = str(mark?.CalculatedScoreString) || null;

  const email = str(c.StaffEMail);
  const room = str(c.Room);

  const course: Course = {
    id: `${period}-${title}`,
    period,
    title,
    teacher: parseTeacher(str(c.Staff)),
    level: detectLevel(title),
    official: {
      percent: officialPercent,
      letter: officialLetter && officialLetter.toUpperCase() !== "N/A" ? officialLetter : null,
    },
    weighted,
    categories,
    assignments,
  };
  if (email) course.teacherEmail = email;
  if (room) course.room = room;
  return course;
}

/** Parses the inner Gradebook XML (already unescaped once) into the Gradebook model. */
export function parseGradebook(innerXml: string): Gradebook {
  const doc = parseInner(innerXml);
  return parseGradebookDoc(doc.Gradebook as Attrs | undefined);
}

/** Builds the Gradebook model from an XML-shaped <Gradebook> object (shared by the XML and JSON paths). */
export function parseGradebookDoc(gb: Attrs | undefined): Gradebook {
  if (!gb || typeof gb !== "object") {
    throw new StudentVueError("MALFORMED", "StudentVUE did not return a gradebook.");
  }
  const errorMessage = str(gb.ErrorMessage);
  if (errorMessage) throw new StudentVueError("UPSTREAM_ERROR", errorMessage);

  const reportPeriods: ReportPeriod[] = arr((gb.ReportingPeriods as Attrs)?.ReportPeriod).map((p, i) => ({
    index: num(p.Index) ?? i,
    name: str(p.GradePeriod) || `Period ${i + 1}`,
    start: toIsoDate(str(p.StartDate)),
    end: toIsoDate(str(p.EndDate)),
  }));

  // <ReportingPeriod GradePeriod="..."> (singular) is the period this response is for.
  const current = gb.ReportingPeriod as Attrs | undefined;
  let currentPeriod = reportPeriods.length ? reportPeriods[reportPeriods.length - 1].index : 0;
  if (current && typeof current === "object") {
    const name = str(current.GradePeriod);
    const start = toIsoDate(str(current.StartDate));
    const match =
      reportPeriods.find((p) => p.name === name && (!start || p.start === start)) ??
      reportPeriods.find((p) => p.name === name);
    if (match) currentPeriod = match.index;
  }

  const courses = arr((gb.Courses as Attrs)?.Course).map(parseCourse);
  return { reportPeriods, currentPeriod, courses };
}

// --- JSON API (StudentVUE (New)) -------------------------------------------------------
//
// The JSON gradebook mirrors the XML one with camelCased names and plain arrays
// (courses[].marks[].assignments[]). We map it onto the XML shape so both formats go through
// exactly the same parsing rules. Key matching is case-insensitive to tolerate casing drift.

const CANONICAL_KEYS = [
  "ErrorMessage", "ReportingPeriods", "ReportPeriod", "ReportingPeriod", "Index", "GradePeriod", "StartDate", "EndDate",
  "Courses", "Course", "Period", "Title", "CourseName", "Room", "Staff", "StaffEMail", "Marks", "Mark", "MarkName",
  "CalculatedScoreString", "CalculatedScoreRaw", "GradeCalculationSummary", "AssignmentGradeCalc", "Type", "Weight",
  "Points", "PointsPossible", "WeightedPct", "CalculatedMark", "Assignments", "Assignment", "GradebookID", "Measure",
  "Date", "DueDate", "Score", "ScoreType", "Notes",
];
const CANONICAL = new Map(CANONICAL_KEYS.map((k) => [k.toLowerCase(), k]));

/** Recursively renames keys to their XML spelling (gradebookID -> GradebookID, staffEMail -> StaffEMail). */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  const out: Attrs = {};
  for (const [k, v] of Object.entries(value as Attrs)) {
    const key = CANONICAL.get(k.toLowerCase()) ?? k.charAt(0).toUpperCase() + k.slice(1);
    out[key] = canonicalize(v);
  }
  return out;
}

/** Calc rows may arrive as an array, as {assignmentGradeCalc: [...]}, or as some other wrapper. */
function calcRows(summary: unknown): Attrs[] {
  if (Array.isArray(summary)) return summary as Attrs[];
  if (!summary || typeof summary !== "object") return [];
  const s = summary as Attrs;
  if (s.AssignmentGradeCalc !== undefined) return arr(s.AssignmentGradeCalc);
  const firstArray = Object.values(s).find(Array.isArray);
  return (firstArray as Attrs[] | undefined) ?? [];
}

/** Unwraps {Assignment: [...]} style containers or returns the array itself. */
function listOf(value: unknown, inner: string): Attrs[] {
  if (Array.isArray(value)) return value as Attrs[];
  if (value && typeof value === "object" && (value as Attrs)[inner] !== undefined) return arr((value as Attrs)[inner]);
  return [];
}

/** Parses `data.traditionalGradebook` from the JSON API's Gradebook method. */
export function parseJsonGradebook(traditional: unknown): Gradebook {
  if (!traditional || typeof traditional !== "object") {
    throw new StudentVueError("MALFORMED", "StudentVUE did not return a gradebook.");
  }
  const gb = canonicalize(traditional) as Attrs;
  const shaped: Attrs = {
    ErrorMessage: gb.ErrorMessage ?? "",
    ReportingPeriods: { ReportPeriod: listOf(gb.ReportingPeriods, "ReportPeriod") },
    ReportingPeriod: gb.ReportingPeriod,
    Courses: {
      Course: listOf(gb.Courses, "Course").map((c) => ({
        ...c,
        Marks: {
          Mark: listOf(c.Marks, "Mark").map((m) => ({
            ...m,
            GradeCalculationSummary: { AssignmentGradeCalc: calcRows(m.GradeCalculationSummary) },
            Assignments: { Assignment: listOf(m.Assignments, "Assignment") },
          })),
        },
      })),
    },
  };
  return parseGradebookDoc(shaped);
}

/** Pulls a display name out of a StudentInfo response; null if not present. */
export function parseStudentName(innerXml: string): string | null {
  const doc = parseInner(innerXml);
  const info = (doc.StudentInfo ?? doc) as Attrs;
  const raw = info.NickName || info.FormattedName || info.FirstName;
  const name = str(typeof raw === "object" && raw !== null ? (raw as Attrs)["#text"] : raw);
  return name || null;
}

export type DistrictResult = { name: string; url: string; address?: string };

/** Parses the district lookup response. */
export function parseDistricts(innerXml: string): DistrictResult[] {
  const doc = parseInner(innerXml);
  const list = arr(findKey(doc, "DistrictInfo"));
  return list
    .map((d) => ({ name: str(d.Name), url: str(d.PvueURL), address: str(d.Address) || undefined }))
    .filter((d) => d.name && d.url);
}
