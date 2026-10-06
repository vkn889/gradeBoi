import { describe, expect, it } from "vitest";
import { findCourses, findCredits, findCumulativeRow, findGpas, summarizeTranscript, type TranscriptLine } from "@/lib/transcript/parse";
import { groupLines, pdfToLines } from "@/lib/transcript/extract";
import { makePdf } from "@/lib/demo/pdf";
import { DEMO_TRANSCRIPT_COURSES, demoDocumentContentData, demoTranscriptGpa } from "@/lib/demo/documents";
import { parseDocumentContent } from "@/lib/studentvue/documents";

const L = (...cells: string[]): TranscriptLine => ({ text: cells.join("  "), cells });

describe("findGpas", () => {
  it("reads inline labels and prefers cumulative over term GPAs", () => {
    const s = summarizeTranscript([
      L("Term GPA: 3.20"),
      L("Cumulative GPA: 3.857"),
      L("Total Credits Earned: 18.000"),
    ]);
    expect(s.printed.unlabeled).toBe(3.857);
    expect(s.gpa).toEqual({ unweighted: 3.857, weighted: null, credits: 18 });
  });

  it("separates weighted from unweighted, in cells or in one string", () => {
    const g = findGpas([L("Cum Weighted GPA", "4.012"), L("Cum Unweighted GPA", "3.857")]);
    expect(g.find((x) => x.kind === "weighted")?.value).toBe(4.012);
    expect(g.find((x) => x.kind === "unweighted")?.value).toBe(3.857);
    const one = summarizeTranscript([{ text: "GPA (Unweighted) 3.50 GPA (Weighted) 3.75", cells: [] }]);
    expect(one.printed.unweighted).toBe(3.5);
  });

  it("reads a label row above a value row", () => {
    const s = summarizeTranscript([
      L("Unweighted GPA", "Weighted GPA", "GPA Credits", "Credits Earned"),
      L("3.612", "3.904", "11.500", "12.000"),
    ]);
    expect(s.gpa).toEqual({ unweighted: 3.612, weighted: 3.904, credits: 11.5 });
  });

  it("ignores numbers that aren't GPAs", () => {
    expect(findGpas([L("Student ID 123456"), L("Class of 2028")])).toEqual([]);
    expect(summarizeTranscript([L("Attendance"), L("Days present 170")]).gpa).toEqual({
      unweighted: null,
      weighted: null,
      credits: null,
    });
  });
});

describe("findCredits / findCourses", () => {
  it("prefers GPA credits over earned credits", () => {
    expect(findCredits([L("Credits Earned", "12.0"), L("GPA Credits", "11.5")])).toBe(11.5);
  });

  it("parses class rows with grade, year and term context", () => {
    const courses = findCourses([
      L("Grade 9", "2024-2025"),
      L("Term", "Course", "Mark", "Credit"),
      L("S1", "Honors Biology", "A-", "0.500"),
      L("S2", "AP Human Geography", "B+", "0.500"),
      L("Grade 10", "2025-2026"),
      L("FY", "Band", "P", "1.000"),
      L("Sem 1", "Geometry", "E", "0.500"),
    ]);
    expect(courses).toEqual([
      { gradeLevel: 9, schoolYear: "2024-2025", term: "S1", name: "Honors Biology", letter: "A-", level: "honors", credits: 0.5 },
      { gradeLevel: 9, schoolYear: "2024-2025", term: "S2", name: "AP Human Geography", letter: "B+", level: "ap", credits: 0.5 },
      { gradeLevel: 10, schoolYear: "2025-2026", term: "S1", name: "Geometry", letter: "F", level: "regular", credits: 0.5 },
    ]);
  });

  it("only trusts parsed classes when they reproduce the printed GPA", () => {
    const rows = [L("Grade 9"), L("S1", "English 9", "A", "0.5"), L("S1", "Algebra", "B", "0.5"), L("S1", "Art", "A", "0.5")];
    // (4 + 3 + 4) / 3 = 3.667
    expect(summarizeTranscript([...rows, L("Cumulative GPA", "3.667")]).coursesVerified).toBe(true);
    const wrong = summarizeTranscript([...rows, L("Cumulative GPA", "3.200")]);
    expect(wrong.coursesVerified).toBe(false);
    expect(wrong.courses).toEqual([]);
    expect(wrong.gpa.unweighted).toBe(3.2);
  });
});

describe("PDF extraction", () => {
  it("rebuilds table cells from text positions", () => {
    const lines = groupLines([
      { str: "Unweighted GPA", x: 0, y: 100, w: 70, h: 9 },
      { str: "3.612", x: 140, y: 100.4, w: 22, h: 9 },
      { str: "Grade", x: 0, y: 80, w: 25, h: 9 },
      { str: "9", x: 28, y: 80, w: 5, h: 9 },
    ]);
    expect(lines).toEqual([
      { text: "Unweighted GPA  3.612", cells: ["Unweighted GPA", "3.612"] },
      { text: "Grade 9", cells: ["Grade 9"] },
    ]);
  });

  it("reads the demo unofficial transcript end to end", async () => {
    const id = "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B01";
    const file = parseDocumentContent(demoDocumentContentData(id), id);
    const s = summarizeTranscript(await pdfToLines(file.data));
    const expected = demoTranscriptGpa();
    expect(s.gpa).toEqual({ unweighted: expected.unweighted, weighted: expected.weighted, credits: expected.credits });
    expect(s.coursesVerified).toBe(true);
    expect(s.courses).toHaveLength(DEMO_TRANSCRIPT_COURSES.length);
    expect(s.courses[0]).toMatchObject({ gradeLevel: 9, schoolYear: "2024-2025", term: "S1", name: "English 9", letter: "A-" });
    expect(s.courses.at(-1)).toMatchObject({ gradeLevel: 10, term: "S2", name: "Spanish 2", letter: "A" });
  });

  it("handles a transcript PDF with no GPA", async () => {
    const lines = await pdfToLines(makePdf([{ text: "Welcome back!" }]));
    expect(summarizeTranscript(lines).gpa.unweighted).toBeNull();
  });

  it("rejects garbage instead of crashing", async () => {
    await expect(pdfToLines(new TextEncoder().encode("%PDF-1.4 not really a pdf"))).rejects.toThrow();
  });
});

describe("Washington / Synergy 'Cumulative' summary row (real North Creek layout)", () => {
  it("takes the rightmost number of the Cumulative row as the GPA and derives GPA credits", () => {
    const lines: TranscriptLine[] = [
      L("******* REPORT PERIOD AND CUMULATIVE SUMMARY *******"),
      L("Grd Lev", "Mo/Yr", "Cred Earn", "Cred Attp", "GPA Earn", "GPA Attp", "GPA Pts", "GPA"),
      L("11", "06/2026", "4.125", "4.125", "4.000", "4.000", "16.000", "4.000"),
      L("Cumulative", "29.250", "29.250", "28.500", "28.500", "113.850", "3.995"),
    ];
    expect(findCumulativeRow(lines)).toEqual({ gpa: 3.995, credits: 28.5 });
    const s = summarizeTranscript(lines);
    expect(s.gpa.unweighted).toBe(3.995);
    expect(s.gpa.credits).toBe(28.5);
    expect(s.notes[0]).toContain("3.995");
  });

  it("handles the row as one joined string too, and ignores the all-caps header", () => {
    const one = summarizeTranscript([
      { text: "REPORT PERIOD AND CUMULATIVE SUMMARY", cells: [] },
      { text: "Cumulative 12.000 12.000 11.500 11.500 44.850 3.900", cells: [] },
    ]);
    expect(one.gpa.unweighted).toBe(3.9);
    expect(one.gpa.credits).toBe(11.5);
  });

  it("ignores a Cumulative row whose last number isn't a GPA", () => {
    expect(findCumulativeRow([L("Cumulative Credits", "29.250")])).toBeNull();
  });

  it("still prefers a Cumulative row over a per-term GPA label elsewhere", () => {
    const s = summarizeTranscript([L("Term GPA: 3.20"), L("Cumulative", "100.000", "3.950")]);
    expect(s.gpa.unweighted).toBe(3.95);
  });
});
