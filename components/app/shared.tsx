"use client";

import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDelta, fmtPct } from "@/lib/format";
import type { Letter } from "@/lib/grades/scale";

/** Letter grade chip. Color is never the only signal: the letter itself is always shown. */
export function LetterBadge({ letter, className, size = "md" }: { letter: Letter | string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const tone =
    letter === null
      ? "bg-muted text-muted-foreground"
      : letter.startsWith("A")
        ? "bg-foreground text-background"
        : letter.startsWith("B")
          ? "bg-gold-wash text-gold ring-1 ring-gold-soft/50"
          : letter.startsWith("C")
            ? "bg-warning-wash text-warning"
            : "bg-danger-wash text-danger";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold tabular tracking-tight",
        size === "sm" && "h-6 min-w-7 px-1.5 text-xs",
        size === "md" && "h-8 min-w-9 px-2 text-sm",
        size === "lg" && "h-11 min-w-12 px-2.5 text-lg",
        tone,
        className,
      )}
    >
      {letter ?? "—"}
    </span>
  );
}

export function DeltaText({ delta, className }: { delta: number | null; className?: string }) {
  if (delta === null) return null;
  const r = Number(delta.toFixed(1));
  return (
    <span
      className={cn(
        "tabular font-medium",
        r > 0 ? "text-success" : r < 0 ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      {fmtDelta(delta)}
      <span className="sr-only"> percentage points</span>
    </span>
  );
}

/** "91.2% → 88.7%" with the change. */
export function RealVsHypo({ real, hypo, delta }: { real: number | null; hypo: number | null; delta: number | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 tabular">
      <span className="text-muted-foreground line-through decoration-muted-foreground/50">{fmtPct(real)}</span>
      <span aria-hidden className="text-muted-foreground">
        →
      </span>
      <span className="sr-only">to</span>
      <span className="font-semibold">{fmtPct(hypo)}</span>
      <DeltaText delta={delta} className="text-sm" />
    </span>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-lg font-semibold">Couldn&apos;t load your grades</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <AnimateIcon animateOnHover asChild>
        <Button className="mt-5 h-11 px-5" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden />
          Try again
        </Button>
      </AnimateIcon>
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>{children}</h2>;
}
