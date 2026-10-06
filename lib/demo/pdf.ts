// Minimal single-page PDF writer (Helvetica text only) for demo documents. No dependencies.

/** A line of text, or table cells placed at x positions (like a real transcript's columns). */
export type PdfLine = { text?: string; cells?: { x: number; text: string }[]; size?: number; bold?: boolean; gap?: number };

function esc(s: string) {
  // PDF string literal escaping; drop characters outside Latin-1 for the standard fonts.
  return s.replace(/[^\x20-\x7e\xa0-\xff]/g, "").replace(/([\\()])/g, "\\$1");
}

export function makePdf(lines: PdfLine[]): Uint8Array {
  let y = 760;
  const ops: string[] = ["BT"];
  for (const l of lines) {
    const size = l.size ?? 11;
    y -= l.gap ?? size + 6;
    const font = `/${l.bold ? "F2" : "F1"} ${size} Tf`;
    if (l.cells) {
      for (const c of l.cells) ops.push(`${font} 1 0 0 1 ${56 + c.x} ${y} Tm (${esc(c.text)}) Tj`);
    } else {
      ops.push(`${font} 1 0 0 1 56 ${y} Tm (${esc(l.text ?? "")}) Tj`);
    }
  }
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(Buffer.from(out, "latin1"));
}
