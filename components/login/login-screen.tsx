"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GradientText } from "@/components/animate-ui/primitives/texts/gradient";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { LogIn } from "@/components/animate-ui/icons/log-in";
import { Lock } from "@/components/animate-ui/icons/lock";
import { MapPin } from "@/components/animate-ui/icons/map-pin";
import { Search } from "@/components/animate-ui/icons/search";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { Gauge } from "@/components/animate-ui/icons/gauge";
import { BellRing } from "@/components/animate-ui/icons/bell-ring";
import { LoaderCircle } from "@/components/animate-ui/icons/loader-circle";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "@/components/brand/logo";
import { NoirCursor } from "@/components/brand/noir-cursor";
import { prefsStore, updatePrefs } from "@/lib/client/stores";
import { DEFAULT_PREFS } from "@/lib/client/storage";
import type { ApiError } from "@/lib/types";

type District = { name: string; url: string; address?: string };

const FEATURES = [
  { Icon: Gauge, title: "GPA, done for you", body: "Weighted and unweighted, updated live." },
  { Icon: Sparkles, title: "What-if mode", body: "Edit scores, add work, see the change instantly." },
  { Icon: BellRing, title: "Nothing slips by", body: "New grades and missing work, flagged up top." },
];

export function LoginScreen({ expired }: { expired: boolean }) {
  const router = useRouter();
  const prefs = prefsStore.useValue();

  const [tab, setTab] = React.useState("signin");
  // Local edits override remembered prefs until submit.
  const [usernameDraft, setUsernameDraft] = React.useState<string | null>(null);
  const [district, setDistrict] = React.useState<District | null>(null);
  const [remember, setRemember] = React.useState<boolean | null>(null);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<{ field: "password" | "form"; message: string } | null>(
    expired ? { field: "form", message: "Your session ended. Sign in again to keep going." } : null,
  );
  const [pending, setPending] = React.useState<"login" | "demo" | null>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const username = usernameDraft ?? prefs.username;
  const activeDistrict: District = district ?? { name: prefs.districtName, url: prefs.districtUrl };
  const rememberMe = remember ?? prefs.remember;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!username.trim() || !password) {
      setError({ field: "password", message: "Enter your username and password." });
      return;
    }
    setPending("login");
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ districtUrl: activeDistrict.url, username: username.trim(), password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        const message = body?.error.message ?? "Sign-in failed. Try again.";
        if (res.status === 401) {
          setPassword("");
          setError({ field: "password", message });
          passwordRef.current?.focus();
        } else {
          setError({ field: "form", message });
        }
        return;
      }
      // "Remember me" keeps district and username only. Never the password.
      updatePrefs(
        rememberMe
          ? { districtUrl: activeDistrict.url, districtName: activeDistrict.name, username: username.trim(), remember: true }
          : { districtUrl: DEFAULT_PREFS.districtUrl, districtName: DEFAULT_PREFS.districtName, username: "", remember: false },
      );
      setPassword("");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError({ field: "form", message: "Couldn't reach GradeBoi. Check your connection and try again." });
    } finally {
      setPending(null);
    }
  }

  async function tryDemo() {
    if (pending) return;
    setPending("demo");
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });
      if (!res.ok) throw new Error();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError({ field: "form", message: "Couldn't open the demo. Try again." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="noir-backdrop relative flex min-h-dvh flex-col">
      <NoirCursor />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-4 sm:px-6">
        <Wordmark className="text-base" />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-16">
        <section aria-labelledby="hero-title" className="text-center lg:text-left">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-gold-soft" aria-hidden />
            For StudentVUE · Synergy districts
          </p>
          <h1 id="hero-title" className="text-6xl font-semibold tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            <GradientText
              text="GradeBoi"
              gradient="var(--title-gradient)"
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground lg:mx-0">
            Your grades, your GPA, and every what-if, in one clean view. Faster than StudentVUE, and it does the math.
          </p>
          <ul className="mx-auto mt-8 hidden max-w-md gap-3 text-left sm:grid lg:mx-0">
            {FEATURES.map(({ Icon, title, body }) => (
              <AnimateIcon key={title} animateOnHover asChild>
                <li className="flex items-start gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-card/60">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground">{body}</span>
                  </span>
                </li>
              </AnimateIcon>
            ))}
          </ul>
        </section>

        <section aria-label="Sign in" className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(0,0,0,0.35)] sm:p-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-11 w-full">
                <TabsTrigger value="signin" data-cursor="Sign in">Sign in</TabsTrigger>
                <TabsTrigger value="district" data-cursor="Find your district">District</TabsTrigger>
              </TabsList>
              <TabsContents className="mt-2">
                <TabsContent value="signin" className="p-0.5">
                  <form onSubmit={submit} noValidate className="mt-3 space-y-4" aria-describedby={error?.field === "form" ? "form-error" : undefined}>
                    <div>
                      <span className="mb-1.5 block text-sm font-medium">District</span>
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                        <MapPin size={18} className="shrink-0 text-gold" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{activeDistrict.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {activeDistrict.url.replace(/^https:\/\//, "")}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setTab("district")}
                          className="min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-gold underline-offset-4 hover:underline"
                          data-cursor="Change district"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="h-11 text-base"
                        value={username}
                        onChange={(e) => setUsernameDraft(e.target.value)}
                        data-cursor="Your StudentVUE username"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        ref={passwordRef}
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        className="h-11 text-base"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-invalid={error?.field === "password" || undefined}
                        aria-describedby={error?.field === "password" ? "password-error" : undefined}
                        data-cursor="Never stored"
                        required
                      />
                      {error?.field === "password" && (
                        <p id="password-error" role="alert" className="text-sm font-medium text-danger">
                          {error.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                        Remember district and username
                      </Label>
                      <Switch id="remember" checked={rememberMe} onCheckedChange={setRemember} />
                    </div>

                    {error?.field === "form" && (
                      <p id="form-error" role="alert" className="rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger">
                        {error.message}
                      </p>
                    )}

                    <AnimateIcon animateOnHover asChild>
                      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending !== null} data-cursor="Let's go">
                        {pending === "login" ? (
                          <LoaderCircle animate loop size={18} aria-hidden />
                        ) : (
                          <LogIn size={18} aria-hidden />
                        )}
                        {pending === "login" ? "Signing in…" : "Sign in with StudentVUE"}
                      </Button>
                    </AnimateIcon>

                    <div className="relative py-1 text-center text-xs text-muted-foreground">
                      <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
                      <span className="relative bg-card px-2">or</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-11 w-full"
                      onClick={tryDemo}
                      disabled={pending !== null}
                      data-cursor="No account needed"
                    >
                      {pending === "demo" ? <LoaderCircle animate loop size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
                      Explore with demo grades
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="district" className="p-0.5">
                  <DistrictFinder
                    onPick={(d) => {
                      setDistrict(d);
                      setTab("signin");
                    }}
                  />
                </TabsContent>
              </TabsContents>
            </Tabs>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
            <Lock size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
            <p>
              <strong className="font-medium text-foreground">We never store your password.</strong> It&apos;s encrypted in
              your browser session and used only to fetch your grades. GradeBoi is not affiliated with Edupoint.{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                Privacy
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function DistrictFinder({ onPick }: { onPick: (d: District) => void }) {
  const [zip, setZip] = React.useState("");
  const [state, setState] = React.useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; results: District[] }
  >({ kind: "idle" });
  const [manual, setManual] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setState({ kind: "error", message: "Enter a 5-digit zip code." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/districts?zip=${zip}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ kind: "error", message: (body as ApiError | null)?.error.message ?? "Search failed." });
        return;
      }
      setState({ kind: "done", results: body as District[] });
    } catch {
      setState({ kind: "error", message: "Couldn't reach GradeBoi. Check your connection." });
    }
  }

  function useManual(e: React.FormEvent) {
    e.preventDefault();
    let raw = manual.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
      const host = new URL(raw).hostname.toLowerCase();
      if (!host.includes(".")) throw new Error();
      setManualError(null);
      onPick({ name: host, url: `https://${host}` });
    } catch {
      setManualError("That doesn't look like a web address.");
    }
  }

  return (
    <div className="mt-3 space-y-5">
      <form onSubmit={search} className="space-y-1.5" noValidate>
        <Label htmlFor="zip">Search by school zip code</Label>
        <div className="flex gap-2">
          <Input
            id="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="98011"
            className="h-11 text-base"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            aria-describedby="zip-status"
          />
          <AnimateIcon animateOnHover asChild>
            <Button type="submit" className="h-11 px-4" disabled={state.kind === "loading"} aria-label="Search districts">
              {state.kind === "loading" ? <LoaderCircle animate loop size={18} aria-hidden /> : <Search size={18} aria-hidden />}
            </Button>
          </AnimateIcon>
        </div>
        <div id="zip-status" aria-live="polite">
          {state.kind === "error" && <p className="text-sm font-medium text-danger">{state.message}</p>}
          {state.kind === "done" && state.results.length === 0 && (
            <p className="text-sm text-muted-foreground">No StudentVUE districts found near {zip}.</p>
          )}
        </div>
      </form>

      {state.kind === "done" && state.results.length > 0 && (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-label="Districts">
          {state.results.map((d) => (
            <li key={d.url + d.name}>
              <button
                type="button"
                onClick={() => onPick(d)}
                className="flex min-h-11 w-full items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-gold-soft hover:bg-gold-wash"
                data-cursor="Use this district"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{d.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{d.address || d.url}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={useManual} className="space-y-1.5 border-t border-border pt-4" noValidate>
        <Label htmlFor="district-url">Or paste your StudentVUE address</Label>
        <div className="flex gap-2">
          <Input
            id="district-url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="wa-nor-psv.edupoint.com"
            className="h-11 text-base"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            aria-invalid={manualError ? true : undefined}
            aria-describedby={manualError ? "district-url-error" : undefined}
          />
          <Button type="submit" variant="outline" className="h-11">
            Use
          </Button>
        </div>
        {manualError && (
          <p id="district-url-error" className="text-sm font-medium text-danger">
            {manualError}
          </p>
        )}
      </form>

      <button
        type="button"
        onClick={() => onPick({ name: DEFAULT_PREFS.districtName, url: DEFAULT_PREFS.districtUrl })}
        className="min-h-11 text-sm font-medium text-gold underline-offset-4 hover:underline"
      >
        Use Northshore School District
      </button>
    </div>
  );
}
