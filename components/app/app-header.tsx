"use client";

import Link from "next/link";
import { useGradebook } from "@/components/providers/gradebook-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoMark } from "@/components/brand/logo";
import dynamic from "next/dynamic";
import { LogOut } from "@/components/animate-ui/icons/log-out";
import { RefreshCw } from "@/components/animate-ui/icons/refresh-cw";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SettingsDialog = dynamic(() => import("@/components/app/settings-dialog").then((m) => m.SettingsDialog), {
  ssr: false,
  loading: () => <span className="inline-block size-9 shrink-0 sm:size-10" aria-hidden />,
});

const iconButton =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full sm:size-10 border border-border bg-card/70 text-foreground backdrop-blur transition-colors hover:bg-accent disabled:opacity-50";

export function AppHeader() {
  const { gradebook, period, load, refreshing, logout, status } = useGradebook();
  const periods = gradebook?.reportPeriods ?? [];

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/dashboard" className="flex min-h-11 shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label="GradeBoi dashboard">
          <LogoMark className="size-8" />
          <span className="hidden sm:inline">GradeBoi</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {periods.length > 0 && period !== null && (
            <Select value={String(period)} onValueChange={(v) => void load(Number(v))} disabled={refreshing}>
              <SelectTrigger className="h-9 min-w-0 max-w-[8rem] rounded-full bg-card/70 sm:h-10 sm:max-w-none" aria-label="Grading period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {periods.map((p) => (
                  <SelectItem key={p.index} value={String(p.index)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <AnimateIcon animateOnHover asChild>
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => void load(period ?? undefined)}
                  disabled={refreshing || status === "loading"}
                  aria-label="Refresh grades"
                >
                  <RefreshCw size={17} animate={refreshing} loop={refreshing} aria-hidden />
                </button>
              </AnimateIcon>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          <SettingsDialog triggerClassName={iconButton} />
          <ThemeToggle className="size-9 shrink-0 sm:size-10" />

          <Tooltip>
            <TooltipTrigger asChild>
              <AnimateIcon animateOnHover asChild>
                <button type="button" className={iconButton} onClick={() => void logout()} aria-label="Sign out">
                  <LogOut size={17} aria-hidden />
                </button>
              </AnimateIcon>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
