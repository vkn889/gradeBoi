import { getDocumentProxy } from "unpdf";
import type { TranscriptLine } from "./parse";

// Turns a transcript PDF into lines of table cells using pdf.js text positions.
// Text only: nothing is rendered or executed, and limits keep hostile files cheap.

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 12;

type Item = { str: string; x: number; y: number; w: number; h: number };

export async function pdfToLines(data: Uint8Array): Promise<TranscriptLine[]> {
  if (data.byteLength > MAX_PDF_BYTES) throw new Error("PDF too large");
  // pdf.js may transfer/detach the buffer, so hand it a copy.
  const pdf = await getDocumentProxy(new Uint8Array(data), {
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    stopAtErrors: false,
    // Text extraction doesn't need standard font data; silence pdf.js's warning about it.
    verbosity: 0,
  });
  try {
    const lines: TranscriptLine[] = [];
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items as { str?: string; transform?: number[]; width?: number; height?: number }[]) {
        if (!raw.str || !raw.transform || !raw.str.trim()) continue;
        items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width ?? 0, h: raw.height ?? 10 });
      }
      lines.push(...groupLines(items));
    }
    return lines;
  } finally {
    await pdf.cleanup();
    await (pdf as unknown as { loadingTask?: { destroy(): Promise<void> } }).loadingTask?.destroy();
  }
}

/** Groups text items into visual lines (top to bottom) and cells (split where the gap is wide). */
export function groupLines(items: Item[]): TranscriptLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(2, it.h * 0.35));
    if (row) row.push(it);
    else rows.push([it]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let current = "";
    let lastEnd = -Infinity;
    for (const it of row) {
      const gap = it.x - lastEnd;
      // A gap wider than ~1.2 characters starts a new cell (table column).
      const charW = it.str.length ? it.w / it.str.length : 5;
      if (current && gap > Math.max(6, charW * 1.2)) {
        cells.push(current.trim());
        current = it.str;
      } else {
        current += (current && gap > charW * 0.15 && !current.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
      }
      lastEnd = it.x + it.w;
    }
    if (current.trim()) cells.push(current.trim());
    return { text: cells.join("  "), cells };
  });
}
