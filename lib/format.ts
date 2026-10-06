// Display formatting.

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDelta(n: number, digits = 1): string {
  const r = Number(n.toFixed(digits));
  if (r === 0) return `±0.${"0".repeat(digits)}`;
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)}`;
}

/** 8 -> "8", 8.5 -> "8.5", 8.333333 -> "8.33" */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

export function fmtGpa(n: number | null): string {
  return n === null ? "—" : n.toFixed(2);
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Days from today to an ISO date (negative = past). */
export function daysFromToday(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

/** "Rivera, Elena" -> "Elena Rivera" */
export function teacherName(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim());
  return parts.length === 2 && parts[0] && parts[1] ? `${parts[1]} ${parts[0]}` : raw;
}

export function courseSlug(id: string): string {
  return encodeURIComponent(id);
}
