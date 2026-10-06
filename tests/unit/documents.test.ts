import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  isValidDocumentId,
  parseDocumentContent,
  parseDocumentList,
  safeFileName,
} from "@/lib/studentvue/documents";
import { makePdf } from "@/lib/demo/pdf";
import { demoDocumentContentData, demoDocumentListData } from "@/lib/demo/documents";

const GUID = "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B01";

describe("parseDocumentList", () => {
  it("parses the documented GetStudentDocuments shape, transcripts first then newest", () => {
    const docs = parseDocumentList({
      studentDocuments: {
        studentDocumentDatas: [
          { documentGU: "A-1", documentFileName: "a.pdf", documentDate: "05/01/2026", documentType: "Report Card", documentComment: "S2 Report Card" },
          { documentGU: "B-2", documentFileName: "b.pdf", documentDate: "09/10/2026", documentType: "Parent Letter", documentComment: "" },
          { documentGU: "C-3", documentFileName: "c.pdf", documentDate: "01/02/2026", documentType: "Transcript", documentComment: "Unofficial Transcript" },
          { documentGU: "bad id!", documentType: "Report Card" },
        ],
      },
    });
    expect(docs.map((d) => d.id)).toEqual(["C-3", "B-2", "A-1"]);
    expect(docs[0]).toMatchObject({ name: "Unofficial Transcript", type: "Transcript", date: "2026-01-02", isTranscript: true });
    expect(docs[1]).toMatchObject({ name: "Parent Letter", isTranscript: false });
  });

  it("tolerates a single object and odd casing", () => {
    expect(parseDocumentList({ StudentDocuments: { StudentDocumentDatas: { DocumentGU: "X-1", DocumentType: "Test Report" } } })).toHaveLength(1);
    expect(parseDocumentList(null)).toEqual([]);
  });
});

describe("parseDocumentContent", () => {
  it("decodes the inline base64 PDF and names it after its type", () => {
    const data = demoDocumentContentData(GUID)!;
    const file = parseDocumentContent(data, GUID);
    expect(file.contentType).toBe("application/pdf");
    expect(file.fileName).toBe("Transcript.pdf");
    expect(Buffer.from(file.data).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("rejects a missing document", () => {
    expect(() => parseDocumentContent({ studentAttachedDocumentData: { documentDatas: [] } }, GUID)).toThrow(
      expect.objectContaining({ code: "MALFORMED" }),
    );
  });
});

describe("file safety", () => {
  it("never serves HTML or unknown types inline", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(contentTypeFor("x.html", html)).toBe("application/octet-stream");
    expect(contentTypeFor("x.pdf", html)).toBe("application/octet-stream");
    expect(contentTypeFor("x.bin", html)).toBe("application/octet-stream");
    expect(contentTypeFor("x.docx", html)).toMatch(/wordprocessingml/);
    expect(contentTypeFor("x", Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
  });
  it("cleans file names and validates ids", () => {
    expect(safeFileName(`${GUID}.pdf`, "Report Card")).toBe("Report Card.pdf");
    expect(safeFileName('../../evil"name.pdf', "")).toBe("evilname.pdf");
    expect(isValidDocumentId(GUID)).toBe(true);
    expect(isValidDocumentId("../etc/passwd")).toBe(false);
    expect(isValidDocumentId("")).toBe(false);
  });
});

describe("demo documents and PDF writer", () => {
  it("lists a transcript first", () => {
    const docs = parseDocumentList(demoDocumentListData(new Date(2026, 9, 5)));
    expect(docs[0].isTranscript).toBe(true);
    expect(docs).toHaveLength(4);
  });
  it("writes a structurally valid PDF with a correct xref offset", () => {
    const pdf = Buffer.from(makePdf([{ text: "Hello (world) \\ test", size: 14 }]));
    const s = pdf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    expect(s).toContain("(Hello \\(world\\) \\\\ test) Tj");
  });
});
