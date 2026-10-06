import type { StudentDocument } from "@/lib/types";

/** Most recent transcript, preferring ones labeled "unofficial" (the copy StudentVUE posts). */
export function pickTranscript(docs: StudentDocument[]): StudentDocument | null {
  const transcripts = docs.filter((d) => d.isTranscript);
  if (!transcripts.length) return null;
  return [...transcripts].sort(
    (a, b) =>
      Number(/unofficial/i.test(`${b.name} ${b.type}`)) - Number(/unofficial/i.test(`${a.name} ${a.type}`)) ||
      (b.date > a.date ? 1 : b.date < a.date ? -1 : 0),
  )[0];
}
