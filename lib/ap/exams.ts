// AP exams and an estimated 1-5 score model.
//
// The College Board does not publish exact scoring worksheets or the year-to-year composite
// cutoffs, so this is an ESTIMATE: each exam weights multiple-choice and free-response into a
// percent, and widely-cited approximate cutoffs map that percent to a 1-5. Real cutoffs move a few
// points each year, so treat a result near a boundary as "could go either way".

export type ApScore = 1 | 2 | 3 | 4 | 5;

export type CutoffProfile = Record<ApScore, number>; // min fraction (0-1) of the weighted total

// Approximate cutoff families, as a fraction of the maximum weighted score.
export const PROFILES = {
  stem: { 5: 0.67, 4: 0.55, 3: 0.42, 2: 0.28, 1: 0 },
  science: { 5: 0.7, 4: 0.58, 3: 0.45, 2: 0.32, 1: 0 },
  social: { 5: 0.72, 4: 0.6, 3: 0.47, 2: 0.33, 1: 0 },
  english: { 5: 0.78, 4: 0.64, 3: 0.5, 2: 0.37, 1: 0 },
  language: { 5: 0.75, 4: 0.62, 3: 0.48, 2: 0.34, 1: 0 },
  arts: { 5: 0.73, 4: 0.6, 3: 0.46, 2: 0.33, 1: 0 },
  capstone: { 5: 0.8, 4: 0.66, 3: 0.5, 2: 0.35, 1: 0 },
} satisfies Record<string, CutoffProfile>;

export type ProfileName = keyof typeof PROFILES;

export type ApExam = {
  id: string;
  name: string;
  category: string;
  /** multiple-choice question count (0 when the exam has no MCQ section) */
  mcqCount: number;
  /** total free-response points (0 when there is no FRQ section) */
  frqMax: number;
  /** multiple-choice share of the score, 0-1; the rest is free response */
  mcqWeight: number;
  profile: ProfileName;
  /** keywords used to recognize this exam in a transcript/course name */
  match: RegExp;
  note?: string;
};

// Section sizes are approximate and only set the relative MCQ/FRQ weighting in the estimate.
export const AP_EXAMS: ApExam[] = [
  { id: "calc-ab", name: "Calculus AB", category: "Math & CS", mcqCount: 45, frqMax: 54, mcqWeight: 0.5, profile: "stem", match: /\bcalc(ulus)?\s*ab\b|\bap calc(ulus)? a\b/i },
  { id: "calc-bc", name: "Calculus BC", category: "Math & CS", mcqCount: 45, frqMax: 54, mcqWeight: 0.5, profile: "stem", match: /\bcalc(ulus)?\s*bc\b/i },
  { id: "precalc", name: "Precalculus", category: "Math & CS", mcqCount: 40, frqMax: 24, mcqWeight: 0.625, profile: "stem", match: /\bpre-?calc(ulus)?\b/i },
  { id: "stats", name: "Statistics", category: "Math & CS", mcqCount: 40, frqMax: 50, mcqWeight: 0.5, profile: "stem", match: /\bstat(istic)?s?\b/i },
  { id: "csa", name: "Computer Science A", category: "Math & CS", mcqCount: 40, frqMax: 36, mcqWeight: 0.5, profile: "stem", match: /\bcomp(uter)?\.?\s*sci(ence)?\s*a\b|\bcse\s*12/i },
  { id: "csp", name: "Computer Science Principles", category: "Math & CS", mcqCount: 70, frqMax: 0, mcqWeight: 1, profile: "stem", match: /\bcomp(uter)?\.?\s*sci(ence)?\s*principles\b|\bcs\s*principles\b|\bcsp\b/i, note: "Your Create performance task also counts toward the real score; this estimate uses the multiple-choice exam only." },
  { id: "bio", name: "Biology", category: "Sciences", mcqCount: 60, frqMax: 48, mcqWeight: 0.5, profile: "science", match: /\bbiology\b|\bap bio\b/i },
  { id: "chem", name: "Chemistry", category: "Sciences", mcqCount: 60, frqMax: 46, mcqWeight: 0.5, profile: "science", match: /\bchem(istry)?\b/i },
  { id: "env", name: "Environmental Science", category: "Sciences", mcqCount: 80, frqMax: 30, mcqWeight: 0.6, profile: "science", match: /\benviron(mental)?\s*sci(ence)?\b|\bapes\b/i },
  { id: "phys-1", name: "Physics 1", category: "Sciences", mcqCount: 50, frqMax: 45, mcqWeight: 0.5, profile: "stem", match: /\bphysics\s*1\b/i },
  { id: "phys-2", name: "Physics 2", category: "Sciences", mcqCount: 50, frqMax: 45, mcqWeight: 0.5, profile: "stem", match: /\bphysics\s*2\b/i },
  { id: "phys-c-mech", name: "Physics C: Mechanics", category: "Sciences", mcqCount: 35, frqMax: 45, mcqWeight: 0.5, profile: "stem", match: /\bphysics\s*c\b.*mech|mech.*physics\s*c\b/i },
  { id: "phys-c-em", name: "Physics C: E&M", category: "Sciences", mcqCount: 35, frqMax: 45, mcqWeight: 0.5, profile: "stem", match: /\bphysics\s*c\b.*(e&m|electr)|electr.*physics\s*c\b/i },
  { id: "eng-lang", name: "English Language", category: "English", mcqCount: 45, frqMax: 54, mcqWeight: 0.45, profile: "english", match: /\beng(lish)?\.?\s*lang(uage)?\b|\blang\s*(and|&)\s*comp/i },
  { id: "eng-lit", name: "English Literature", category: "English", mcqCount: 55, frqMax: 54, mcqWeight: 0.45, profile: "english", match: /\beng(lish)?\.?\s*lit(erature)?\b/i },
  { id: "apush", name: "U.S. History", category: "History & Social Science", mcqCount: 55, frqMax: 40, mcqWeight: 0.4, profile: "social", match: /\bu\.?s\.?\s*history\b|\bapush\b|\bamerican history\b/i },
  { id: "world", name: "World History: Modern", category: "History & Social Science", mcqCount: 55, frqMax: 40, mcqWeight: 0.4, profile: "social", match: /\bworld history\b/i },
  { id: "euro", name: "European History", category: "History & Social Science", mcqCount: 55, frqMax: 40, mcqWeight: 0.4, profile: "social", match: /\beuro(pean)?\s*history\b/i },
  { id: "gov-us", name: "U.S. Government", category: "History & Social Science", mcqCount: 55, frqMax: 25, mcqWeight: 0.5, profile: "social", match: /\b(u\.?s\.?\s*)?gov(ernment)?\b(?!.*compar)/i },
  { id: "gov-comp", name: "Comparative Government", category: "History & Social Science", mcqCount: 55, frqMax: 25, mcqWeight: 0.5, profile: "social", match: /\bcompar(ative)?\s*gov/i },
  { id: "psych", name: "Psychology", category: "History & Social Science", mcqCount: 75, frqMax: 14, mcqWeight: 0.667, profile: "social", match: /\bpsych(ology)?\b/i },
  { id: "human-geo", name: "Human Geography", category: "History & Social Science", mcqCount: 60, frqMax: 21, mcqWeight: 0.5, profile: "social", match: /\bhuman geo(graphy)?\b|\baphug\b/i },
  { id: "macro", name: "Macroeconomics", category: "History & Social Science", mcqCount: 60, frqMax: 30, mcqWeight: 0.667, profile: "social", match: /\bmacro(econ(omics)?)?\b/i },
  { id: "micro", name: "Microeconomics", category: "History & Social Science", mcqCount: 60, frqMax: 30, mcqWeight: 0.667, profile: "social", match: /\bmicro(econ(omics)?)?\b/i },
  { id: "art-history", name: "Art History", category: "Arts", mcqCount: 80, frqMax: 60, mcqWeight: 0.5, profile: "arts", match: /\bart history\b/i },
  { id: "music-theory", name: "Music Theory", category: "Arts", mcqCount: 75, frqMax: 64, mcqWeight: 0.5, profile: "arts", match: /\bmusic theory\b/i },
  { id: "spanish-lang", name: "Spanish Language", category: "World Languages", mcqCount: 65, frqMax: 20, mcqWeight: 0.5, profile: "language", match: /\bspanish\s*lang(uage)?\b/i },
  { id: "spanish-lit", name: "Spanish Literature", category: "World Languages", mcqCount: 65, frqMax: 24, mcqWeight: 0.5, profile: "language", match: /\bspanish\s*lit(erature)?\b/i },
  { id: "french", name: "French Language", category: "World Languages", mcqCount: 65, frqMax: 20, mcqWeight: 0.5, profile: "language", match: /\bfrench\b/i },
  { id: "german", name: "German Language", category: "World Languages", mcqCount: 65, frqMax: 20, mcqWeight: 0.5, profile: "language", match: /\bgerman\b/i },
  { id: "chinese", name: "Chinese Language", category: "World Languages", mcqCount: 70, frqMax: 20, mcqWeight: 0.5, profile: "language", match: /\bchinese\b|\bmandarin\b/i },
  { id: "japanese", name: "Japanese Language", category: "World Languages", mcqCount: 70, frqMax: 20, mcqWeight: 0.5, profile: "language", match: /\bjapanese\b/i },
  { id: "latin", name: "Latin", category: "World Languages", mcqCount: 50, frqMax: 60, mcqWeight: 0.5, profile: "language", match: /\blatin\b/i },
  { id: "seminar", name: "Seminar (Capstone)", category: "AP Capstone", mcqCount: 0, frqMax: 45, mcqWeight: 0, profile: "capstone", match: /\bseminar\b/i, note: "Most of the real score comes from team and individual projects; this estimate uses the written exam only." },
  { id: "research", name: "Research (Capstone)", category: "AP Capstone", mcqCount: 0, frqMax: 100, mcqWeight: 0, profile: "capstone", match: /\bap research\b/i, note: "Scored from your academic paper and presentation; this is a rough estimate only." },
];

export const EXAMS_BY_ID: Record<string, ApExam> = Object.fromEntries(AP_EXAMS.map((e) => [e.id, e]));

export function examById(id: string): ApExam | undefined {
  return EXAMS_BY_ID[id];
}

export type ScoreEstimate = {
  /** weighted fraction of the maximum, 0-1 */
  percent: number;
  score: ApScore;
  /** fraction still needed to reach the next score up, null at 5 */
  toNext: number | null;
  nextScore: ApScore | null;
};

/** Estimates a 1-5 from a raw multiple-choice count and free-response points. */
export function estimateScore(exam: ApExam, input: { mcqCorrect: number; frqEarned: number }): ScoreEstimate {
  const clamp = (v: number, max: number) => (max <= 0 ? 0 : Math.max(0, Math.min(max, v)));
  const mcqFrac = exam.mcqCount > 0 ? clamp(input.mcqCorrect, exam.mcqCount) / exam.mcqCount : 0;
  const frqFrac = exam.frqMax > 0 ? clamp(input.frqEarned, exam.frqMax) / exam.frqMax : 0;
  const w = exam.frqMax > 0 ? exam.mcqWeight : exam.mcqCount > 0 ? 1 : 0;
  const percent = w * mcqFrac + (1 - w) * frqFrac;
  return scoreFromPercent(exam, percent);
}

export function scoreFromPercent(exam: ApExam, percent: number): ScoreEstimate {
  const cutoffs = PROFILES[exam.profile];
  let score: ApScore = 1;
  for (const s of [5, 4, 3, 2] as ApScore[]) {
    if (percent >= cutoffs[s]) {
      score = s;
      break;
    }
  }
  const nextScore = score < 5 ? ((score + 1) as ApScore) : null;
  const toNext = nextScore ? Math.max(0, cutoffs[nextScore] - percent) : null;
  return { percent, score, toNext, nextScore };
}
