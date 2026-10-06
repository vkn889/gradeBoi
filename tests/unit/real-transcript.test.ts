import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pdfToLines } from "@/lib/transcript/extract";
import { summarizeTranscript } from "@/lib/transcript/parse";

// Runs only when you've saved your own transcript with `SAVE=1 npm run phase0`.
// `npm run transcript:check` prints what GradeBoi reads from it. The file is gitignored.
const file = join(__dirname, "../fixtures/real-transcript.local.pdf");

describe.skipIf(!existsSync(file))("your real transcript (local only)", () => {
  it("reads a GPA from it", async () => {
    const lines = await pdfToLines(new Uint8Array(readFileSync(file)));
    const s = summarizeTranscript(lines);
    console.log("\nRead from your transcript:", JSON.stringify({ gpa: s.gpa, printed: s.printed, notes: s.notes }, null, 2));
    if (process.env.SHOW_LINES === "1") console.log(lines.map((l) => l.cells.join(" | ")).join("\n"));
    expect(s.gpa.unweighted ?? s.gpa.weighted).not.toBeNull();
  });
});
