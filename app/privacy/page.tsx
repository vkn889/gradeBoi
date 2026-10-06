import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="noir-backdrop min-h-dvh">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-4 sm:px-6">
        <Link href="/" aria-label="GradeBoi home">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-3 text-muted-foreground">Short version: we never store your password, and we don&apos;t keep your grades.</p>

        <div className="mt-10 space-y-8 leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          <section>
            <h2>Your password</h2>
            <p>
              When you sign in, your StudentVUE username and password are sent to GradeBoi&apos;s server over HTTPS and
              checked with your district. They&apos;re then encrypted into a secure, httpOnly cookie in your own browser
              that expires after 2 hours. GradeBoi has no database: your password is never written to disk, a database,
              or logs. Signing out deletes the cookie.
            </p>
          </section>
          <section>
            <h2>Your grades</h2>
            <p>
              Grades are fetched from StudentVUE each time you visit, sent to your browser, and kept in memory only. All
              grade and GPA math happens on your device. GradeBoi never saves your grades on its server.
            </p>
          </section>
          <section>
            <h2>What stays on your device</h2>
            <ul>
              <li>Your district and username, if you choose &quot;Remember&quot; (never your password)</li>
              <li>Your grade scale, rounding, GPA settings, and class level overrides</li>
              <li>Your hypothetical edits and saved scenarios</li>
              <li>Which assignments you&apos;ve already seen, for new-grade highlights</li>
            </ul>
            <p>You can clear all of this anytime from Settings, or by clearing site data in your browser.</p>
          </section>
          <section>
            <h2>Tracking</h2>
            <p>No ads, no tracking scripts, no third-party cookies. Nothing is tied to your StudentVUE account.</p>
          </section>
          <section>
            <h2>Not affiliated with Edupoint</h2>
            <p>
              GradeBoi is an independent, read-only tool. It is not affiliated with, endorsed by, or supported by
              Edupoint, Synergy, StudentVUE, or your school district. It can&apos;t change anything in StudentVUE, and
              only ever reads your own grades.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-12 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
          Back to GradeBoi
        </Link>
      </main>
    </div>
  );
}
