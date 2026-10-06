"use client";

import * as React from "react";
import { CursorProvider, Cursor, CursorFollow } from "@/components/animate-ui/components/animate/cursor";

function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Animated custom cursor (Animate UI Cursor). The follow label reads the nearest
 * `data-cursor` attribute under the pointer. Only on precise pointers (mouse/trackpad),
 * never on touch, and off when the user prefers reduced motion.
 */
export function NoirCursor({ defaultLabel = "GradeBoi" }: { defaultLabel?: string }) {
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [label, setLabel] = React.useState(defaultLabel);

  React.useEffect(() => {
    if (!finePointer || reducedMotion) return;
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-cursor]");
      setLabel(el?.getAttribute("data-cursor") || defaultLabel);
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => document.removeEventListener("pointerover", onOver);
  }, [finePointer, reducedMotion, defaultLabel]);

  if (!finePointer || reducedMotion) return null;

  return (
    <CursorProvider global className="pointer-events-none">
      <Cursor className="size-5 text-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
      <CursorFollow
        side="bottom"
        align="end"
        className="rounded-full border border-gold-soft/40 bg-foreground px-2.5 py-1 text-xs font-medium tracking-tight text-background shadow-lg"
      >
        {label}
      </CursorFollow>
    </CursorProvider>
  );
}
