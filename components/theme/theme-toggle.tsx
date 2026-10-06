"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ThemeToggler, type Resolved } from "@/components/animate-ui/primitives/effects/theme-toggler";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Moon } from "@/components/animate-ui/icons/moon";
import { cn } from "@/lib/utils";

/** Light/dark toggle using the Animate UI Theme Toggler (gradual clip-path reveal). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <span className={cn("inline-block size-10", className)} aria-hidden />;
  }

  return (
    <ThemeToggler
      theme={(theme as "light" | "dark" | "system") ?? "system"}
      resolvedTheme={(resolvedTheme as Resolved) ?? "light"}
      setTheme={setTheme}
      direction="ltr"
    >
      {({ resolved, toggleTheme }) => {
        const next = resolved === "dark" ? "light" : "dark";
        return (
          <button
            type="button"
            onClick={() => toggleTheme(next)}
            aria-label={`Switch to ${next} mode`}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full border border-border bg-card/70 text-foreground backdrop-blur transition-colors hover:bg-accent",
              className,
            )}
          >
            {resolved === "dark" ? (
              <Moon size={18} animateOnHover aria-hidden />
            ) : (
              <Sun size={18} animateOnHover aria-hidden />
            )}
          </button>
        );
      }}
    </ThemeToggler>
  );
}
