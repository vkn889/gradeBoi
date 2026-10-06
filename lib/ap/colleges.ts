import type { ApScore } from "./exams";

// College AP credit — an ESTIMATE, not an official award.
//
// Real policies are per-exam, change every year, and often depend on your major, so GradeBoi uses
// a simplified per-college rule (a typical qualifying score and typical credits per exam, in that
// school's own credit units) plus a few well-known exceptions. ALWAYS confirm on the college's
// official AP page (linked). This is meant to tell you roughly how much AP credit a school tends to
// give, not the exact number you'll receive.

export type CreditSystem = "semester" | "quarter";

type ExamOverride = "none" | { min?: ApScore; credits?: number; note?: string };

export type College = {
  id: string;
  name: string;
  url: string;
  system: CreditSystem;
  /** typical minimum score that earns credit */
  minScore: ApScore;
  /** typical credits granted per qualifying exam, in `system` units */
  creditsPerExam: number;
  /** rough cap on total AP credit, if the school publishes one */
  maxCredits?: number;
  /** highly selective: AP is mostly used for placement, with little or no degree credit */
  selective?: boolean;
  note: string;
  /** per-exam exceptions to the blanket rule */
  overrides?: Record<string, ExamOverride>;
};

// Washington schools first (GradeBoi launches at Northshore), then large national universities.
export const COLLEGES: College[] = [
  {
    id: "uw",
    name: "University of Washington (Seattle)",
    url: "https://admit.washington.edu/apply/freshman/ap-ib-credit/",
    system: "quarter",
    minScore: 3,
    creditsPerExam: 5,
    note: "UW grants 5 quarter credits for many exams at a 3+, and 10–15 for some (e.g., Calculus BC, foreign languages).",
    overrides: {
      "calc-bc": { credits: 10 },
      "calc-ab": { credits: 5 },
      "spanish-lang": { credits: 10 },
      "spanish-lit": { credits: 10 },
      "french": { credits: 10 },
      "csp": "none",
    },
  },
  {
    id: "uw-bothell",
    name: "UW Bothell",
    url: "https://www.uwb.edu/registration/credit/ap",
    system: "quarter",
    minScore: 3,
    creditsPerExam: 5,
    note: "UW Bothell uses the UW system-wide AP policy: 5 quarter credits for many exams at 3+, more for a few.",
    overrides: { "calc-bc": { credits: 10 }, "csp": "none" },
  },
  {
    id: "wsu",
    name: "Washington State University",
    url: "https://admission.wsu.edu/ap-credits/",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "WSU grants credit for most exams at a 3+, typically 3–8 semester credits depending on the exam.",
    overrides: { "calc-bc": { credits: 5 } },
  },
  {
    id: "wwu",
    name: "Western Washington University",
    url: "https://admissions.wwu.edu/apply/freshman/ap-ib-credit",
    system: "quarter",
    minScore: 3,
    creditsPerExam: 5,
    note: "Western grants quarter credits for most exams at a 3+, with more for some full-year subjects.",
  },
  {
    id: "ucla",
    name: "UCLA",
    url: "https://www.admission.ucla.edu/apply/ap-ib-credit",
    system: "quarter",
    minScore: 3,
    creditsPerExam: 8,
    maxCredits: 48,
    note: "UC grants 8 quarter units per exam at a 3+ (about 5.3 semester). Credit counts toward units; subject credit depends on your major.",
  },
  {
    id: "berkeley",
    name: "UC Berkeley",
    url: "https://admissions.berkeley.edu/ap-and-ib-credits/",
    system: "semester",
    minScore: 3,
    creditsPerExam: 5.3,
    maxCredits: 32,
    note: "UC grants about 5.3 semester units per exam at a 3+. How it applies to requirements depends on your college and major.",
  },
  {
    id: "umich",
    name: "University of Michigan",
    url: "https://admissions.umich.edu/apply/applying-transfer-credit/ap-ib-credit",
    system: "semester",
    minScore: 4,
    creditsPerExam: 4,
    note: "Michigan generally grants credit at a 4+ (a few exams at 3), usually a few semester credits each.",
    overrides: { "calc-ab": { min: 4, credits: 4 }, "calc-bc": { min: 4, credits: 8 } },
  },
  {
    id: "gatech",
    name: "Georgia Tech",
    url: "https://registrar.gatech.edu/info/ap-credit",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "Georgia Tech grants credit for most exams at a 3 or 4, commonly 3–4 semester hours each.",
    overrides: { "eng-lit": "none" },
  },
  {
    id: "utaustin",
    name: "UT Austin",
    url: "https://admissions.utexas.edu/explore/credit-by-exam/",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "UT Austin grants credit for most exams at a 3+, often 3–6 semester hours, sometimes with a required score of 4.",
  },
  {
    id: "purdue",
    name: "Purdue University",
    url: "https://www.admissions.purdue.edu/academics/creditbyexam.php",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "Purdue grants credit for most exams at a 3+, typically 3–5 semester credits each.",
  },
  {
    id: "uiuc",
    name: "University of Illinois (UIUC)",
    url: "https://admissions.illinois.edu/invest/ap-credit",
    system: "semester",
    minScore: 3,
    creditsPerExam: 4,
    note: "Illinois grants credit for most exams at a 3+ (some require 4–5), commonly 3–5 semester hours.",
  },
  {
    id: "asu",
    name: "Arizona State University",
    url: "https://admission.asu.edu/transfer/ap-credit",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "ASU grants credit for most exams at a 3+, typically 3–8 semester credits each.",
  },
  {
    id: "osu",
    name: "Ohio State University",
    url: "https://registrar.osu.edu/transfercredit/ap_tables.html",
    system: "semester",
    minScore: 3,
    creditsPerExam: 3,
    note: "Ohio State grants credit for most exams at a 3+, usually 3–5 semester credit hours each.",
  },
  {
    id: "nyu",
    name: "New York University",
    url: "https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/all-freshmen-applicants/academic-credit.html",
    system: "semester",
    minScore: 4,
    creditsPerExam: 4,
    note: "NYU grants credit mostly at a 4 or 5, and the amount and eligibility vary a lot by school within NYU.",
  },
  {
    id: "usc",
    name: "University of Southern California",
    url: "https://arr.usc.edu/services/apcredit/",
    system: "semester",
    minScore: 4,
    creditsPerExam: 4,
    note: "USC grants credit mostly at a 4 or 5, commonly 4 semester units per exam.",
    overrides: { "calc-bc": { credits: 8 } },
  },
  {
    id: "stanford",
    name: "Stanford University",
    url: "https://registrar.stanford.edu/students/ap-and-ib-credit",
    system: "quarter",
    minScore: 4,
    creditsPerExam: 4,
    selective: true,
    note: "Stanford grants limited units for certain exams at a 4 or 5; most AP is used for placement, not degree credit.",
    overrides: { "calc-bc": { credits: 10 }, "psych": "none", "human-geo": "none", "eng-lang": "none" },
  },
  {
    id: "mit",
    name: "MIT",
    url: "https://firstyear.mit.edu/academics-exploration/ap-other-credit/",
    system: "semester",
    minScore: 5,
    creditsPerExam: 0,
    selective: true,
    note: "MIT gives credit for only a few exams (mainly Calculus and Physics C) at a 5; most AP is placement only.",
    overrides: {
      "calc-bc": { min: 5, credits: 12, note: "Covers one semester of calculus" },
      "phys-c-mech": { min: 5, credits: 6 },
      "phys-c-em": { min: 5, credits: 6 },
    },
  },
  {
    id: "harvard",
    name: "Harvard University",
    url: "https://college.harvard.edu/academics/planning-your-degree/advanced-standing",
    system: "semester",
    minScore: 5,
    creditsPerExam: 0,
    selective: true,
    note: "Harvard does not grant degree credit for AP exams; they're used only for placement.",
  },
];

export const COLLEGES_BY_ID: Record<string, College> = Object.fromEntries(COLLEGES.map((c) => [c.id, c]));

export type ExamCredit = {
  examId: string;
  score: ApScore;
  min: ApScore;
  eligible: boolean;
  credits: number;
  note?: string;
};

/** Credit for one exam+score at a college (0 when the score is below the threshold). */
export function creditFor(college: College, examId: string, score: ApScore): ExamCredit {
  const o = college.overrides?.[examId];
  if (o === "none") {
    return { examId, score, min: college.minScore, eligible: false, credits: 0, note: "No AP credit for this exam" };
  }
  const min = (o && o.min) ?? college.minScore;
  const perExam = (o && o.credits) ?? college.creditsPerExam;
  const eligible = score >= min;
  return { examId, score, min, eligible, credits: eligible ? perExam : 0, note: o?.note };
}

export type CreditEstimate = {
  college: College;
  perExam: ExamCredit[];
  /** total credits before any cap */
  rawTotal: number;
  /** total after the college's cap, if any */
  total: number;
  capped: boolean;
};

/** Estimated total AP credit at a college given the student's exam scores. */
export function estimateCredits(college: College, scores: Record<string, ApScore>): CreditEstimate {
  const perExam = Object.entries(scores)
    .map(([examId, score]) => creditFor(college, examId, score))
    .sort((a, b) => b.credits - a.credits);
  const rawTotal = perExam.reduce((t, e) => t + e.credits, 0);
  const total = college.maxCredits ? Math.min(rawTotal, college.maxCredits) : rawTotal;
  return { college, perExam, rawTotal, total: Math.round(total * 10) / 10, capped: total < rawTotal };
}
