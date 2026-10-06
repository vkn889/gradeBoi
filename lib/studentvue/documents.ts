import type { DocumentFile, StudentDocument } from "@/lib/types";
import { StudentVueError, toIsoDate } from "./parse";

// Parsing for the JSON API's GetStudentDocuments / GetStudentDocumentContent responses
// (StudentVue/docs JSON-API.md "Documents"). Keys are matched case-insensitively.

type Obj = Record<string, unknown>;

export function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const entries = Object.entries(obj as Obj);
  for (const key of keys) {
    const hit = entries.find(([k]) => k.toLowerCase() === key.toLowerCase());
    if (hit && hit[1] !== undefined && hit[1] !== null) return hit[1];
  }
  return undefined;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export function isTranscript(...fields: string[]) {
  return fields.some((f) => /transcript/i.test(f));
}

/** Document ids are GUIDs; anything else is rejected before it reaches StudentVUE. */
export function isValidDocumentId(id: string) {
  return /^[A-Za-z0-9{}-]{1,80}$/.test(id);
}

/** data.studentDocuments -> documents, transcripts first, then newest first. */
export function parseDocumentList(data: unknown): StudentDocument[] {
  const container = pick(data, "studentDocuments") ?? data;
  const list = pick(container, "studentDocumentDatas", "studentDocumentData", "documents");
  const rows = Array.isArray(list) ? list : list && typeof list === "object" ? [list] : [];
  const docs: StudentDocument[] = [];
  for (const row of rows) {
    const id = text(pick(row, "documentGU", "DocumentGU", "gu"));
    if (!id || !isValidDocumentId(id)) continue;
    const type = text(pick(row, "documentType", "docType", "category")) || "Document";
    const comment = text(pick(row, "documentComment", "comment", "notes"));
    const fileName = text(pick(row, "documentFileName", "fileName")) || undefined;
    docs.push({
      id,
      name: comment || type,
      type,
      date: toIsoDate(text(pick(row, "documentDate", "docDate", "date"))),
      fileName,
      isTranscript: isTranscript(type, comment, fileName ?? ""),
    });
  }
  return sortDocuments(docs);
}

export function sortDocuments(docs: StudentDocument[]): StudentDocument[] {
  return [...docs].sort(
    (a, b) => Number(b.isTranscript) - Number(a.isTranscript) || (b.date > a.date ? 1 : b.date < a.date ? -1 : 0),
  );
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
  htm: "text/html; charset=utf-8",
  html: "text/html; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Only these are safe to show inline; anything else is forced to download. */
export const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif"]);

export function contentTypeFor(fileName: string, data: Uint8Array): string {
  // Trust magic bytes over the file name for the types we render inline.
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) return "application/pdf";
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8) return "image/jpeg";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME[ext];
  // Never serve HTML-ish content from our origin.
  if (!mime || mime.startsWith("text/html") || INLINE_TYPES.has(mime)) return "application/octet-stream";
  return mime;
}

/** data.studentAttachedDocumentData.documentDatas[] -> the requested file. */
export function parseDocumentContent(data: unknown, id: string): DocumentFile {
  const container = pick(data, "studentAttachedDocumentData") ?? data;
  const list = pick(container, "documentDatas", "documentData");
  const rows = Array.isArray(list) ? list : list ? [list] : [];
  const row =
    rows.find((r) => text(pick(r, "documentGU")).toLowerCase() === id.toLowerCase()) ?? rows[0];
  const b64 = text(pick(row, "base64Code", "base64", "content"));
  if (!row || !b64) throw new StudentVueError("MALFORMED", "StudentVUE didn't return that document.");
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  if (bytes.length === 0) throw new StudentVueError("MALFORMED", "StudentVUE returned an empty document.");
  const rawName = text(pick(row, "fileName", "documentFileName")) || `${id}.pdf`;
  const typeName = text(pick(row, "docType", "category", "documentType"));
  return { fileName: safeFileName(rawName, typeName), contentType: contentTypeFor(rawName, bytes), data: bytes };
}

/** "<GUID>.pdf" is useless to a student; prefer "Report Card.pdf". Strips unsafe characters. */
export function safeFileName(rawName: string, typeName: string): string {
  // Keep only the last path segment, without leading dots.
  const raw = rawName.split(/[\\/]/).pop()!.replace(/^\.+/, "");
  const ext = (raw.includes(".") ? raw.split(".").pop() : "pdf")!.replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "pdf";
  const base = raw.replace(/\.[^.]*$/, "");
  const looksLikeGuid = /^[{]?[0-9a-f-]{20,}[}]?$/i.test(base);
  const name = (looksLikeGuid && typeName ? typeName : base).replace(/[^\w .()-]+/g, "").trim().slice(0, 80) || "document";
  return `${name}.${ext}`;
}
