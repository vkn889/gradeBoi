"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Download } from "@/components/animate-ui/icons/download";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, SectionTitle } from "@/components/app/shared";
import type { ApiError, StudentDocument } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; documents: StudentDocument[] };

function fullDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The student's StudentVUE documents: transcripts, report cards, test reports, letters. */
export function Documents() {
  const router = useRouter();
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [filter, setFilter] = React.useState("All");

  const load = React.useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as { documents: StudentDocument[] } | ApiError | null;
      if (res.status === 401) {
        router.replace("/?expired=1");
        return;
      }
      if (!res.ok || !body || "error" in body) {
        setState({ kind: "error", message: body && "error" in body ? body.error.message : "Couldn't load your documents." });
        return;
      }
      setState({ kind: "ready", documents: body.documents });
    } catch {
      setState({ kind: "error", message: "Couldn't reach GradeBoi. Check your connection and try again." });
    }
  }, [router]);

  React.useEffect(() => {
    // Deferred so the fetch starts after commit; cancelled on StrictMode's dev re-mount.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const header = (
    <div className="pt-2">
      <p className="text-sm text-muted-foreground">From StudentVUE</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Documents</h1>
    </div>
  );

  if (state.kind === "loading") {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading documents">
        {header}
        <Skeleton className="h-28 w-full rounded-2xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-5">
        {header}
        <ErrorState title="Couldn't load your documents" message={state.message} onRetry={() => void load()} />
      </div>
    );
  }

  const docs = state.documents;
  const transcripts = docs.filter((d) => d.isTranscript);
  const types = ["All", ...Array.from(new Set(docs.map((d) => d.type)))];
  const shown = filter === "All" ? docs : docs.filter((d) => d.type === filter);

  return (
    <div className="space-y-6">
      {header}

      {transcripts.length > 0 ? (
        <section
          aria-labelledby="transcript-title"
          className="relative overflow-hidden rounded-2xl bg-foreground p-5 text-background sm:p-6"
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-gold-soft/25 blur-3xl" />
          <p id="transcript-title" className="relative text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
            Transcript
          </p>
          <ul className="relative mt-2 space-y-3">
            {transcripts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-lg font-semibold">{d.name}</span>
                  <span className="text-sm opacity-70">Posted {fullDate(d.date)}</span>
                </span>
                <DocActions doc={d} inverted />
              </li>
            ))}
          </ul>
          <p className="relative mt-4 text-xs opacity-70">
            Copies in StudentVUE are usually unofficial. Colleges generally need an official transcript sent by your school.
          </p>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No transcript is posted in StudentVUE yet. Some schools don&apos;t publish it there; your counselor can send an
          official copy.
        </p>
      )}

      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Your school hasn&apos;t posted any documents to StudentVUE.
        </p>
      ) : (
        <section aria-labelledby="all-docs" className="space-y-3">
          <SectionTitle>
            <span id="all-docs">All documents ({docs.length})</span>
          </SectionTitle>
          {types.length > 2 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by type">
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilter(t)}
                  aria-pressed={filter === t}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                    filter === t ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-accent",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {shown.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.type} · {fmtDate(d.date)}
                  </span>
                </span>
                <DocActions doc={d} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DocActions({ doc, inverted }: { doc: StudentDocument; inverted?: boolean }) {
  const href = `/api/documents/${encodeURIComponent(doc.id)}`;
  const base = "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors";
  return (
    <span className="flex shrink-0 gap-2">
      <AnimateIcon animateOnHover asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(base, inverted ? "bg-background text-foreground hover:bg-background/90" : "border border-border hover:bg-accent")}
          aria-label={`View ${doc.name}`}
        >
          <ExternalLink size={14} aria-hidden /> View
        </a>
      </AnimateIcon>
      <AnimateIcon animateOnHover asChild>
        <a
          href={`${href}?download=1`}
          download
          className={cn(base, inverted ? "bg-background/10 hover:bg-background/20" : "hover:bg-accent")}
          aria-label={`Download ${doc.name}`}
        >
          <Download size={14} aria-hidden /> Download
        </a>
      </AnimateIcon>
    </span>
  );
}
