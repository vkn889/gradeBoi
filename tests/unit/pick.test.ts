import { describe, expect, it } from "vitest";
import { pickTranscript } from "@/lib/transcript/pick";
import type { StudentDocument } from "@/lib/types";

const d = (id: string, name: string, date: string, isTranscript = true): StudentDocument => ({ id, name, type: isTranscript ? "Transcript" : "Report Card", date, isTranscript });

describe("pickTranscript", () => {
  it("prefers unofficial transcripts, then the newest", () => {
    expect(pickTranscript([d("a", "Transcript", "2026-09-01"), d("b", "Unofficial Transcript", "2026-01-01")])?.id).toBe("b");
    expect(pickTranscript([d("a", "Unofficial Transcript", "2025-09-01"), d("b", "Unofficial Transcript", "2026-09-01")])?.id).toBe("b");
    expect(pickTranscript([d("r", "Report Card", "2026-09-01", false)])).toBeNull();
  });
});
