import { makePdf } from "./pdf";
import { DEMO_STUDENT_NAME } from "./generate";

// Demo documents in the exact JSON shapes StudentVUE's GetStudentDocuments /
// GetStudentDocumentContent return, so the demo exercises the real parsers.

import type { PdfLine } from "./pdf";

type DemoDoc = { gu: string; type: string; comment: string; daysAgo: number; lines: PdfLine[] };

/** Past-year classes on the demo transcript: [grade, school year, term, course, mark, credits]. */
export const DEMO_TRANSCRIPT_COURSES: [number, string, string, string, string, number][] = [
  [9, "2024-2025", "S1", "English 9", "A-", 0.5],
  [9, "2024-2025", "S1", "Algebra 1", "A", 0.5],
  [9, "2024-2025", "S1", "Biology", "B+", 0.5],
  [9, "2024-2025", "S1", "Spanish 1", "A", 0.5],
  [9, "2024-2025", "S2", "English 9", "A", 0.5],
  [9, "2024-2025", "S2", "Algebra 1", "A-", 0.5],
  [9, "2024-2025", "S2", "Biology", "A-", 0.5],
  [9, "2024-2025", "S2", "Spanish 1", "A", 0.5],
  [10, "2025-2026", "S1", "Honors English 10", "B+", 0.5],
  [10, "2025-2026", "S1", "Geometry", "A", 0.5],
  [10, "2025-2026", "S1", "AP Human Geography", "B+", 0.5],
  [10, "2025-2026", "S1", "Spanish 2", "A-", 0.5],
  [10, "2025-2026", "S2", "Honors English 10", "A-", 0.5],
  [10, "2025-2026", "S2", "Geometry", "A", 0.5],
  [10, "2025-2026", "S2", "AP Human Geography", "A-", 0.5],
  [10, "2025-2026", "S2", "Spanish 2", "A", 0.5],
];

const POINTS: Record<string, number> = { A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, F: 0 };

/** The GPA the demo transcript prints, computed independently of lib/grades (AP +1.0, Honors +0.5). */
export function demoTranscriptGpa() {
  let u = 0;
  let w = 0;
  let cr = 0;
  for (const [, , , course, mark, credits] of DEMO_TRANSCRIPT_COURSES) {
    const p = POINTS[mark];
    const bonus = p >= 2 ? (/\bAP\b/.test(course) ? 1 : /Honors/.test(course) ? 0.5 : 0) : 0;
    u += p * credits;
    w += (p + bonus) * credits;
    cr += credits;
  }
  return { unweighted: Math.round((u / cr) * 1000) / 1000, weighted: Math.round((w / cr) * 1000) / 1000, credits: cr };
}

function transcriptLines(): PdfLine[] {
  const gpa = demoTranscriptGpa();
  const lines: PdfLine[] = [
    { text: "UNOFFICIAL TRANSCRIPT", size: 16, bold: true, gap: 0 },
    { text: `${DEMO_STUDENT_NAME}   -   Demo High School   -   Class of 2028`, size: 10, gap: 20 },
    { text: "Sample data from the GradeBoi demo account.", size: 8, gap: 14 },
  ];
  let year = "";
  for (const [grade, schoolYear, term, course, mark, credits] of DEMO_TRANSCRIPT_COURSES) {
    if (schoolYear !== year) {
      year = schoolYear;
      lines.push({ cells: [{ x: 0, text: `Grade ${grade}` }, { x: 70, text: schoolYear }], bold: true, size: 10, gap: 24 });
      lines.push({
        cells: [{ x: 0, text: "Term" }, { x: 50, text: "Course" }, { x: 300, text: "Mark" }, { x: 360, text: "Credit" }],
        bold: true,
        size: 9,
        gap: 15,
      });
    }
    lines.push({
      cells: [{ x: 0, text: term }, { x: 50, text: course }, { x: 300, text: mark }, { x: 360, text: credits.toFixed(3) }],
      size: 9,
      gap: 13,
    });
  }
  lines.push(
    { cells: [{ x: 0, text: "Cumulative Summary" }], bold: true, size: 10, gap: 26 },
    {
      cells: [{ x: 0, text: "Unweighted GPA" }, { x: 140, text: "Weighted GPA" }, { x: 280, text: "Credits Earned" }],
      size: 9,
      bold: true,
      gap: 15,
    },
    {
      cells: [
        { x: 0, text: gpa.unweighted.toFixed(3) },
        { x: 140, text: gpa.weighted.toFixed(3) },
        { x: 280, text: gpa.credits.toFixed(3) },
      ],
      size: 9,
      gap: 13,
    },
  );
  return lines;
}

function fmt(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function docs(): DemoDoc[] {
  return [
    {
      gu: "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B01",
      type: "Transcript",
      comment: "Unofficial Transcript",
      daysAgo: 20,
      lines: transcriptLines(),
    },
    {
      gu: "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B02",
      type: "Report Card",
      comment: "Report Card - Semester 2, 2025-26",
      daysAgo: 110,
      lines: [
        { text: "REPORT CARD", size: 18, bold: true, gap: 0 },
        { text: `${DEMO_STUDENT_NAME}   ·   Grade 10   ·   Semester 2, 2025-26`, gap: 26 },
        { text: "AP Human Geography      A-", gap: 28 },
        { text: "Geometry                A" },
        { text: "Sample data from the GradeBoi demo account.", size: 9, gap: 30 },
      ],
    },
    {
      gu: "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B03",
      type: "Test Report",
      comment: "State Assessment Score Report",
      daysAgo: 60,
      lines: [
        { text: "STATE ASSESSMENT SCORE REPORT", size: 16, bold: true, gap: 0 },
        { text: `${DEMO_STUDENT_NAME}`, gap: 24 },
        { text: "English Language Arts: Level 4 (Exceeded standard)", gap: 24 },
        { text: "Mathematics: Level 3 (Met standard)" },
        { text: "Sample data from the GradeBoi demo account.", size: 9, gap: 30 },
      ],
    },
    {
      gu: "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B04",
      type: "Parent Letter",
      comment: "Welcome Back Letter",
      daysAgo: 35,
      lines: [
        { text: "Welcome back!", size: 16, bold: true, gap: 0 },
        { text: "Classes begin this week. Check StudentVUE for your schedule.", gap: 24 },
        { text: "Sample data from the GradeBoi demo account.", size: 9, gap: 30 },
      ],
    },
  ];
}

export function demoDocumentListData(today = new Date()) {
  return {
    studentDocuments: {
      showDateColumn: true,
      studentGU: "DEMO",
      studentDocumentDatas: docs().map((d) => {
        const date = new Date(today);
        date.setDate(date.getDate() - d.daysAgo);
        return {
          documentGU: d.gu,
          documentFileName: `${d.gu}.pdf`,
          documentDate: fmt(date),
          documentType: d.type,
          studentGU: "DEMO",
          documentComment: d.comment,
        };
      }),
    },
  };
}

/** null when the id isn't a demo document. */
export function demoDocumentContentData(id: string) {
  const d = docs().find((x) => x.gu.toLowerCase() === id.toLowerCase());
  if (!d) return null;
  return {
    studentAttachedDocumentData: {
      documentDatas: [
        {
          documentGU: d.gu,
          fileName: `${d.gu}.pdf`,
          category: d.type,
          docType: d.type,
          notes: d.comment,
          base64Code: Buffer.from(makePdf(d.lines)).toString("base64"),
        },
      ],
    },
  };
}
