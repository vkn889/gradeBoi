import { AP_EXAMS, type ApExam } from "./exams";

// Recognizes AP exams from course names (StudentVUE gradebook titles or transcript rows).
// Only names that look like an AP course are considered, so a non-AP "Chemistry Transfer" or a
// regular "US History" is never counted as an AP exam.

function looksAp(name: string): boolean {
  return /\bap\b/i.test(name) || /advanced placement/i.test(name);
}

/** The AP exam a single course name maps to, or null. */
export function matchExam(name: string, { requireAp = true } = {}): ApExam | null {
  if (requireAp && !looksAp(name)) return null;
  for (const exam of AP_EXAMS) if (exam.match.test(name)) return exam;
  return null;
}

/** Unique AP exam ids found across a list of course names, in first-seen order. */
export function detectExams(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const exam = matchExam(name);
    if (exam && !seen.has(exam.id)) {
      seen.add(exam.id);
      out.push(exam.id);
    }
  }
  return out;
}
