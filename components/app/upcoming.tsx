"use client";

import Link from "next/link";
import type { CourseView } from "@/lib/client/course-view";
import { courseSlug, daysFromToday, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Ungraded work due today or later, soonest first, across every class. */
export function Upcoming({ views }: { views: CourseView[] }) {
  const items = views
    .flatMap((v) =>
      v.course.assignments
        .filter((a) => a.score === null && (a.status === "ungraded" || a.status === "missing"))
        .map((a) => ({ v, a, days: daysFromToday(a.dueDate ?? a.date) })),
    )
    .filter((x) => x.days !== null && x.days >= 0)
    .sort((x, y) => (x.days as number) - (y.days as number));

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        Nothing due soon. Nice.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map(({ v, a, days }) => (
        <li key={v.course.id + a.id}>
          <Link href={`/class/${courseSlug(v.course.id)}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
            <span
              className={cn(
                "inline-flex w-16 shrink-0 flex-col items-center rounded-lg py-1 text-center",
                days === 0 ? "bg-foreground text-background" : days !== null && days <= 2 ? "bg-gold-wash text-gold" : "bg-muted text-muted-foreground",
              )}
            >
              <span className="text-xs font-semibold">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {v.course.title} · {a.category} · {fmtDate(a.dueDate ?? a.date)}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular text-muted-foreground">{a.possible} pts</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
