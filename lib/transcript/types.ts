import type { TranscriptSummary } from "./parse";

export type TranscriptDocumentRef = { id: string; name: string; date: string };

/**
 * FOUND: GPA read from the transcript. NOT_POSTED: no transcript in StudentVUE documents.
 * NO_GPA: transcript found but no GPA could be read (e.g. a scanned image). UNREADABLE: not a
 * readable PDF. NOT_SUPPORTED: the district's StudentVUE version has no documents.
 */
export type TranscriptResponse =
  | { status: "FOUND"; transcript: TranscriptSummary & { document: TranscriptDocumentRef } }
  | { status: "NOT_POSTED" | "NOT_SUPPORTED"; transcript: null }
  | { status: "NO_GPA" | "UNREADABLE"; transcript: null; document: TranscriptDocumentRef };
