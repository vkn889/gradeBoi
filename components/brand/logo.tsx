import { cn } from "@/lib/utils";

/** GradeBoi mark: an "A" monogram in a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path d="M10 23 16 8.5 22 23" className="stroke-background" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6 17.6h6.8" className="stroke-gold-soft" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className="size-7" />
      <span>GradeBoi</span>
    </span>
  );
}
