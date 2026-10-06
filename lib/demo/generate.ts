// Generates a realistic StudentVUE Gradebook XML response (same shape Synergy returns) for the
// demo account and for tests. Dates are relative to "today" so the demo always has recent grades
// and upcoming work. Official percents are computed here independently of lib/grades so tests can
// verify the engine against them.

type DemoAssignment = {
  name: string;
  type: string;
  /** days from today (negative = past) */
  day: number;
  /** "8.00 / 10.0000" style points, or a raw string for special cases */
  points?: [number, number];
  /** override Points attribute verbatim */
  rawPoints?: string;
  /** override Score attribute verbatim */
  rawScore?: string;
  notes?: string;
};

type DemoCourse = {
  period: number;
  title: string;
  staff: string;
  email: string;
  room: string;
  /** category -> weight %, omit for points-based classes */
  weights?: Record<string, number>;
  assignments: DemoAssignment[];
};

const COURSES: DemoCourse[] = [
  {
    period: 1,
    title: "AP Calculus AB",
    staff: "Rivera, Elena",
    email: "erivera@demo.k12.example",
    room: "214",
    weights: { Tests: 60, Quizzes: 25, Homework: 15 },
    assignments: [
      { name: "Unit 1 Test: Limits", type: "Tests", day: -28, points: [46, 50] },
      { name: "Unit 2 Test: Derivatives", type: "Tests", day: -7, points: [41, 50] },
      { name: "Quiz 1.1", type: "Quizzes", day: -31, points: [9, 10] },
      { name: "Quiz 1.3", type: "Quizzes", day: -24, points: [10, 10] },
      { name: "Quiz 2.1", type: "Quizzes", day: -17, points: [7.5, 10] },
      { name: "Quiz 2.4", type: "Quizzes", day: -3, points: [8, 10] },
      { name: "HW 1.1-1.4", type: "Homework", day: -30, points: [20, 20] },
      { name: "HW 1.5-1.6", type: "Homework", day: -26, points: [18, 20] },
      { name: "HW 2.1-2.2", type: "Homework", day: -19, points: [20, 20] },
      { name: "HW 2.3", type: "Homework", day: -12, points: [0, 20], notes: "Missing" },
      { name: "HW 2.4-2.5", type: "Homework", day: -5, points: [19, 20] },
      { name: "HW 3.1", type: "Homework", day: 2, rawPoints: "20.0000 Points Possible", rawScore: "Not Graded" },
      { name: "Unit 3 Test: Applications", type: "Tests", day: 9, rawPoints: "50.0000 Points Possible", rawScore: "Not Graded" },
    ],
  },
  {
    period: 2,
    title: "Honors English 10",
    staff: "Okafor, Daniel",
    email: "dokafor@demo.k12.example",
    room: "108",
    weights: { "Major Assessments": 50, Writing: 30, "Classwork/Participation": 20 },
    assignments: [
      { name: "Summer Reading Essay", type: "Major Assessments", day: -33, points: [88, 100] },
      { name: "Socratic Seminar: Night", type: "Major Assessments", day: -14, points: [47, 50] },
      { name: "Narrative Draft", type: "Writing", day: -25, points: [27, 30] },
      { name: "Narrative Final", type: "Writing", day: -10, points: [54, 60], notes: "Late" },
      { name: "Reading Log Week 1", type: "Classwork/Participation", day: -29, points: [10, 10] },
      { name: "Reading Log Week 2", type: "Classwork/Participation", day: -22, points: [10, 10] },
      { name: "Reading Log Week 3", type: "Classwork/Participation", day: -15, points: [8, 10] },
      { name: "Reading Log Week 4", type: "Classwork/Participation", day: -8, points: [10, 10] },
      { name: "Vocabulary Bonus", type: "Classwork/Participation", day: -6, points: [3, 0] },
      { name: "Library Orientation", type: "Classwork/Participation", day: -32, rawPoints: "", rawScore: "Not for Grading" },
      { name: "Argument Essay Outline", type: "Writing", day: 4, rawPoints: "30.0000 Points Possible", rawScore: "Not Graded" },
    ],
  },
  {
    period: 3,
    title: "Chemistry Hon",
    staff: "Nguyen, Linh",
    email: "lnguyen@demo.k12.example",
    room: "Lab 3",
    weights: { "Tests & Quizzes": 50, Labs: 35, Practice: 15 },
    assignments: [
      { name: "Safety Quiz", type: "Tests & Quizzes", day: -34, points: [20, 20] },
      { name: "Matter & Measurement Test", type: "Tests & Quizzes", day: -20, points: [68, 80] },
      { name: "Atomic Structure Quiz", type: "Tests & Quizzes", day: -6, points: [17, 25] },
      { name: "Density Lab", type: "Labs", day: -27, points: [24, 25] },
      { name: "Flame Test Lab", type: "Labs", day: -13, points: [22, 25] },
      { name: "Sig Figs Practice", type: "Practice", day: -30, points: [10, 10] },
      { name: "Unit Conversions Practice", type: "Practice", day: -23, points: [9, 10] },
      { name: "Isotopes Practice", type: "Practice", day: -9, points: [0, 10], notes: "Missing - turn in for half credit" },
      { name: "Electron Config Practice", type: "Practice", day: -2, rawPoints: "10.0000 Points Possible", rawScore: "Not Graded", notes: "Missing" },
      { name: "Periodic Trends Lab", type: "Labs", day: 6, rawPoints: "25.0000 Points Possible", rawScore: "Not Graded" },
    ],
  },
  {
    period: 4,
    title: "US History",
    staff: "Patel, Marcus",
    email: "mpatel@demo.k12.example",
    room: "121",
    assignments: [
      { name: "Colonies Map", type: "Classwork", day: -32, points: [15, 15] },
      { name: "Primary Source Analysis 1", type: "Classwork", day: -26, points: [18, 20] },
      { name: "Unit 1 Quiz", type: "Assessment", day: -21, points: [34, 40] },
      { name: "Constitution DBQ", type: "Assessment", day: -11, points: [88, 100] },
      { name: "Current Events 1", type: "Classwork", day: -18, rawScore: "90%", rawPoints: "" },
      { name: "Current Events 2", type: "Classwork", day: -4, points: [10, 10] },
      { name: "Extra Credit: Museum Visit", type: "Classwork", day: -9, points: [5, 0] },
      { name: "Unit 2 Test", type: "Assessment", day: 11, rawPoints: "100.0000 Points Possible", rawScore: "Not Graded" },
    ],
  },
  {
    period: 5,
    title: "Spanish 3",
    staff: "García, Sofía",
    email: "sgarcia@demo.k12.example",
    room: "305",
    weights: { "Summative": 70, "Formative": 30 },
    assignments: [
      { name: "Presentación oral", type: "Summative", day: -16, points: [37, 40] },
      { name: "Examen 1", type: "Summative", day: -5, points: [83, 100] },
      { name: "Tarea 1", type: "Formative", day: -30, points: [10, 10] },
      { name: "Tarea 2", type: "Formative", day: -23, points: [9, 10] },
      { name: "Tarea 3", type: "Formative", day: -15, points: [10, 10] },
      { name: "Tarea 4", type: "Formative", day: -8, points: [6, 10], notes: "Late" },
      { name: "Excused: Field Trip Worksheet", type: "Formative", day: -12, rawPoints: "10.0000 Points Possible", rawScore: "Excused" },
    ],
  },
  {
    period: 6,
    title: "Physical Education",
    staff: "Brooks, Tanya",
    email: "tbrooks@demo.k12.example",
    room: "Gym",
    weights: { Participation: 80, "Skills Tests": 20 },
    assignments: [
      { name: "Week 1 Participation", type: "Participation", day: -31, points: [25, 25] },
      { name: "Week 2 Participation", type: "Participation", day: -24, points: [25, 25] },
      { name: "Week 3 Participation", type: "Participation", day: -17, points: [20, 25] },
      { name: "Week 4 Participation", type: "Participation", day: -10, points: [25, 25] },
      { name: "Week 5 Participation", type: "Participation", day: -3, points: [25, 25] },
    ],
  },
];

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function attr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function letter(p: number): string {
  const scale: [string, number][] = [
    ["A", 93], ["A-", 90], ["B+", 87], ["B", 83], ["B-", 80], ["C+", 77], ["C", 73], ["C-", 70], ["D+", 67], ["D", 60],
  ];
  for (const [l, c] of scale) if (p >= c) return l;
  return "F";
}

type Sums = Map<string, { earned: number; possible: number }>;

/** Independent re-implementation of StudentVUE's math, used only to fill CalculatedScoreRaw. */
function officialPercent(c: DemoCourse, included: DemoAssignment[]): number | null {
  const sums: Sums = new Map();
  for (const a of included) {
    let earned: number | null = null;
    let possible = 0;
    if (a.points) [earned, possible] = a.points;
    else if (a.rawScore && /^\d+(\.\d+)?%$/.test(a.rawScore)) {
      earned = parseFloat(a.rawScore);
      possible = 100;
    }
    if (earned === null) continue;
    const s = sums.get(a.type) ?? { earned: 0, possible: 0 };
    s.earned += earned;
    s.possible += possible;
    sums.set(a.type, s);
  }
  if (!c.weights) {
    let e = 0;
    let p = 0;
    for (const s of sums.values()) {
      e += s.earned;
      p += s.possible;
    }
    return p > 0 ? (e / p) * 100 : null;
  }
  let total = 0;
  let wsum = 0;
  for (const [name, w] of Object.entries(c.weights)) {
    const s = sums.get(name);
    if (!s || s.possible <= 0) continue;
    total += w * (s.earned / s.possible);
    wsum += w;
  }
  return wsum > 0 ? (total / wsum) * 100 : null;
}

export type DemoPeriod = { index: number; name: string; startOffset: number; endOffset: number };

export const DEMO_PERIODS: DemoPeriod[] = [
  { index: 0, name: "Q1 Progress", startOffset: -35, endOffset: -14 },
  { index: 1, name: "Quarter 1", startOffset: -35, endOffset: 30 },
  { index: 2, name: "Q2 Progress", startOffset: 31, endOffset: 55 },
  { index: 3, name: "Quarter 2", startOffset: 31, endOffset: 100 },
];
export const DEMO_CURRENT_PERIOD = 1;

function courseXml(c: DemoCourse, today: Date, period: DemoPeriod): string {
  const included = c.assignments.filter((a) => a.day >= period.startOffset && a.day <= period.endOffset);
  const pct = officialPercent(c, included);
  const raw = pct === null ? "" : pct.toFixed(1);
  const markLetter = pct === null ? "N/A" : letter(Math.round(pct * 10) / 10);

  let calc = "";
  if (c.weights) {
    const rows = Object.entries(c.weights).map(([name, w]) => {
      let e = 0;
      let p = 0;
      for (const a of included) {
        if (a.type !== name || !a.points) continue;
        e += a.points[0];
        p += a.points[1];
      }
      return `<AssignmentGradeCalc Type="${attr(name)}" Weight="${w.toFixed(1)}%" Points="${e.toFixed(2)}" PointsPossible="${p.toFixed(2)}" WeightedPct="${p > 0 ? ((w * e) / p).toFixed(1) : "0.0"}%" CalculatedMark="${p > 0 ? letter((e / p) * 100) : ""}" />`;
    });
    rows.push(`<AssignmentGradeCalc Type="TOTAL" Weight="100%" Points="0" PointsPossible="0" WeightedPct="${raw}%" CalculatedMark="${markLetter}" />`);
    calc = `<GradeCalculationSummary>${rows.join("")}</GradeCalculationSummary>`;
  } else {
    calc = "<GradeCalculationSummary />";
  }

  const assignments = included
    .map((a) => {
      const date = fmtDate(addDays(today, a.day));
      const points = a.rawPoints ?? (a.points ? `${a.points[0].toFixed(2)} / ${a.points[1].toFixed(4)}` : "");
      const score =
        a.rawScore ?? (a.points ? (a.points[1] > 0 ? `${a.points[0]} out of ${a.points[1]}` : `${a.points[0]}`) : "");
      // Stable across periods, like real GradebookIDs.
      const id = `${c.period}${String(c.assignments.indexOf(a)).padStart(3, "0")}`;
      return (
        `<Assignment GradebookID="${id}" Measure="${attr(a.name)}" Type="${attr(a.type)}" Date="${date}" DueDate="${date}" ` +
        `Score="${attr(score)}" ScoreType="Raw Score" Points="${attr(points)}" Notes="${attr(a.notes ?? "")}" ` +
        `TeacherID="" StudentID="" MeasureDescription="" HasDropBox="false" DropStartDate="" DropEndDate=""><Resources /><Standards /></Assignment>`
      );
    })
    .join("");

  return (
    `<Course UsesRichContent="true" Period="${c.period}" Title="${attr(c.title)}" Room="${attr(c.room)}" Staff="${attr(c.staff)}" StaffEMail="${attr(c.email)}" StaffGU="">` +
    `<Marks><Mark MarkName="${attr(period.name)}" CalculatedScoreString="${markLetter}" CalculatedScoreRaw="${raw}">` +
    `<StandardViews />${calc}<Assignments>${assignments}</Assignments></Mark></Marks></Course>`
  );
}

/** Inner Gradebook XML for a period (what ProcessWebServiceRequestResult contains, unescaped). */
export function demoGradebookXml(reportPeriod?: number, today: Date = new Date()): string {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const idx = reportPeriod ?? DEMO_CURRENT_PERIOD;
  const period = DEMO_PERIODS.find((p) => p.index === idx) ?? DEMO_PERIODS[DEMO_CURRENT_PERIOD];
  const periods = DEMO_PERIODS.map(
    (p) =>
      `<ReportPeriod Index="${p.index}" GradePeriod="${attr(p.name)}" StartDate="${fmtDate(addDays(base, p.startOffset))}" EndDate="${fmtDate(addDays(base, p.endOffset))}" />`,
  ).join("");
  return (
    `<Gradebook xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Type="Traditional" ErrorMessage="" HideStandardGraphInd="false" HideMarksColumnElementary="false" HidePointsColumnElementary="false" HidePercentSecondary="false" DisplayStandardsData="false" GBStandardsTabDefault="false">` +
    `<ReportingPeriods>${periods}</ReportingPeriods>` +
    `<ReportingPeriod GradePeriod="${attr(period.name)}" StartDate="${fmtDate(addDays(base, period.startOffset))}" EndDate="${fmtDate(addDays(base, period.endOffset))}" />` +
    `<Courses>${COURSES.map((c) => courseXml(c, base, period)).join("")}</Courses></Gradebook>`
  );
}

/** Wraps inner XML in a SOAP envelope, escaped exactly like Synergy does. */
export function wrapSoapEnvelope(innerXml: string): string {
  const escaped = innerXml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body>' +
    '<ProcessWebServiceRequestResponse xmlns="http://edupoint.com/webservices/"><ProcessWebServiceRequestResult>' +
    escaped +
    "</ProcessWebServiceRequestResult></ProcessWebServiceRequestResponse></soap:Body></soap:Envelope>"
  );
}

export const DEMO_STUDENT_NAME = "Alex Demo";
