import { describe, expect, it } from "vitest";
import { AP_EXAMS, EXAMS_BY_ID, estimateScore, examById, scoreFromPercent } from "@/lib/ap/exams";
import { detectExams, matchExam } from "@/lib/ap/detect";
import { COLLEGES, COLLEGES_BY_ID, creditFor, estimateCredits } from "@/lib/ap/colleges";

describe("AP exam catalog", () => {
  it("has unique ids and covers the common exams", () => {
    const ids = AP_EXAMS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["calc-ab", "calc-bc", "bio", "phys-1", "phys-2", "csa", "csp", "apush", "world", "eng-lang"]) {
      expect(EXAMS_BY_ID[id]).toBeDefined();
    }
    expect(examById("nope")).toBeUndefined();
  });
});

describe("estimateScore", () => {
  const bc = EXAMS_BY_ID["calc-bc"];
  it("maps a strong exam to a 5 and a weak one to a 1", () => {
    expect(estimateScore(bc, { mcqCorrect: 45, frqEarned: 54 }).score).toBe(5);
    expect(estimateScore(bc, { mcqCorrect: 0, frqEarned: 0 }).score).toBe(1);
  });
  it("weights MCQ and FRQ and finds the boundary to the next score", () => {
    // 60% MCQ, 60% FRQ -> 0.60 overall; Calc profile: 4 at 0.55, 5 at 0.67.
    const r = estimateScore(bc, { mcqCorrect: 27, frqEarned: 32.4 });
    expect(r.score).toBe(4);
    expect(r.nextScore).toBe(5);
    expect(r.toNext).toBeCloseTo(0.07, 2);
  });
  it("clamps out-of-range inputs", () => {
    expect(estimateScore(bc, { mcqCorrect: 999, frqEarned: 999 }).percent).toBeLessThanOrEqual(1);
    expect(estimateScore(bc, { mcqCorrect: -5, frqEarned: -5 }).percent).toBe(0);
  });
  it("handles MCQ-only exams (CS Principles)", () => {
    const csp = EXAMS_BY_ID["csp"];
    expect(estimateScore(csp, { mcqCorrect: 70, frqEarned: 0 }).score).toBe(5);
    expect(scoreFromPercent(csp, 0.5).score).toBe(3);
  });
});

describe("detectExams", () => {
  it("recognizes AP courses from messy transcript names and ignores non-AP ones", () => {
    const names = [
      "(MATH&151) CALCULUS I /AP CALC AB",
      "(MATH&152AND153) CALCULUS II AND III / AP CALC BC",
      "AP COMPUTER SCIENCE PRINCIPLES",
      "(CSE 121) INTRO TO COMPUTER PROGR/ AP COMP SCI A",
      "AP PHYSICS 1",
      "AP PHYSICS 2",
      "AP WORLD HISTORY",
      "AP BIOLOGY",
      "AP ENG LANG",
      "AP US HISTORY",
      "CHEMISTRY TRANS",
      "PRE AP ENGLISH 10",
      "ORCHESTRA 9-12",
    ];
    expect(detectExams(names)).toEqual([
      "calc-ab",
      "calc-bc",
      "csp",
      "csa",
      "phys-1",
      "phys-2",
      "world",
      "bio",
      "eng-lang",
      "apush",
    ]);
  });
  it("needs an AP marker, so a plain course name doesn't match", () => {
    expect(matchExam("US History")).toBeNull();
    expect(matchExam("AP US History")?.id).toBe("apush");
    expect(matchExam("Calculus BC", { requireAp: false })?.id).toBe("calc-bc");
  });
});

describe("college credit estimate", () => {
  it("has unique ids and a real URL + note for every college", () => {
    const ids = COLLEGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COLLEGES) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.note.length).toBeGreaterThan(10);
    }
    expect(COLLEGES_BY_ID["uw"].name).toMatch(/Washington/);
  });

  it("grants credit at or above the threshold and nothing below", () => {
    const uw = COLLEGES_BY_ID["uw"];
    expect(creditFor(uw, "bio", 3)).toMatchObject({ eligible: true, credits: 5 });
    expect(creditFor(uw, "bio", 2)).toMatchObject({ eligible: false, credits: 0 });
    // UW override: Calc BC is worth 10 quarter credits.
    expect(creditFor(uw, "calc-bc", 4).credits).toBe(10);
    // "none" override: no credit regardless of score.
    expect(creditFor(uw, "csp", 5)).toMatchObject({ eligible: false, credits: 0 });
  });

  it("respects a higher per-college minimum score", () => {
    const umich = COLLEGES_BY_ID["umich"];
    expect(creditFor(umich, "bio", 3).eligible).toBe(false);
    expect(creditFor(umich, "bio", 4).eligible).toBe(true);
  });

  it("sums credits across exams and applies a cap", () => {
    const ucla = COLLEGES_BY_ID["ucla"]; // 8/exam, cap 48
    const scores = Object.fromEntries(
      ["calc-bc", "bio", "phys-1", "phys-2", "world", "apush", "csa"].map((id) => [id, 5 as const]),
    );
    const est = estimateCredits(ucla, scores);
    expect(est.rawTotal).toBe(56);
    expect(est.total).toBe(48);
    expect(est.capped).toBe(true);
    expect(est.perExam[0].credits).toBe(8);
  });

  it("reflects that elite schools give little raw credit", () => {
    const harvard = COLLEGES_BY_ID["harvard"];
    expect(estimateCredits(harvard, { "calc-bc": 5 } as Record<string, 5>).total).toBe(0);
    const mit = COLLEGES_BY_ID["mit"];
    expect(creditFor(mit, "calc-bc", 5).credits).toBe(12);
    expect(creditFor(mit, "bio", 5).credits).toBe(0);
  });
});
