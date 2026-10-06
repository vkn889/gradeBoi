# GradeBoi

See your StudentVUE grades, calculate your GPA, and try "what if" scores. Built for Synergy districts, starting with Northshore School District (`wa-nor-psv.edupoint.com`).

- **Dashboard**: every class with period, teacher, percent, and letter; cumulative weighted and unweighted GPA (all of high school) with this term's GPA beneath it; missing and late work pinned to the top; new grades flagged.
- **Cumulative GPA** (`/gpa`), automatic: GradeBoi finds the unofficial transcript in your StudentVUE documents, reads the PDF, and takes the GPA and credit total printed on it. It reads the GPA from the "Cumulative" row of the Report Period and Cumulative Summary table (the rightmost number on a Washington/Synergy transcript), then adds this term's classes, weighted by credits. You don't upload or type anything. If no readable transcript is posted, you can enter past classes by hand instead.
- **N/A grades**: a class at 0.0% (nothing entered in the gradebook yet) shows N/A and is never counted in any GPA.
- **AP** (`/ap`): an AP score estimator for ~37 exams (enter raw multiple-choice and free-response points → an estimated 1–5), your AP classes auto-detected from the transcript and schedule, and an estimate of how much college credit those scores would earn at a chosen college (~19 schools, Washington ones first). Score curves and credit policies are approximate and labeled as estimates, with a link to each college's official AP page.
- **Documents** (`/documents`): your StudentVUE documents (transcript pinned first, report cards, test reports, letters), viewable and downloadable as PDFs.
- **Class view**: categories and weights, every assignment, distance to the next letter, grade-over-time chart, biggest-impact assignments, and what one point is worth.
- **Hypothetical mode**: edit scores, add or remove assignments, move assignments between categories, and override category weights. Real and hypothetical grades show side by side, and the GPA updates live. Saved scenarios and a one-tap reset are included. Each assignment gets a management bar (step between assignments, full credit, zero, revert, remove, move to a category). Swipe left to remove.
- **Planning tools**: "What do I need?" solver, final exam calculator, GPA goal planner, and an upcoming-work list.
- **Settings**: custom grade scale, round-to-whole-percent, AP/Honors GPA bonus (+0 / +0.5 / +1.0), and per-class level override.
- Mobile-first (375px+), light and dark themes, installable as a PWA. A demo account works without a StudentVUE login.

GradeBoi is read-only and is **not affiliated with Edupoint**. Passwords are never written to disk, a database, or logs.

## Quick start

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET (openssl rand -hex 32)
npm run dev                  # http://localhost:3000
```

Click **Explore with demo grades** to try everything without a StudentVUE account.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm test` | Vitest unit and integration tests (parser, grade engine, API routes against a mock StudentVUE server) |
| `npm run test:coverage` | Same, with grade-engine coverage (threshold 90%) |
| `npm run test:e2e` | Playwright end to end, on a 375px phone viewport and on desktop |
| `npm run phase0` | Checks real data access with a real login: grades, documents, and transcript download (see below) |
| `npm run transcript:check` | Shows what GradeBoi reads from your own transcript, after saving it with `SAVE=1 npm run phase0` |
| `npm run lint` / `typecheck` | ESLint / TypeScript strict |

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes in production | 32+ random characters used to encrypt the session cookie (iron-session). Dev falls back to a fixed dev secret. |
| `ALLOWED_DISTRICT_DOMAINS` | No | Comma-separated extra district domains, for districts that host StudentVUE on their own domain. `*.edupoint.com` is always allowed. Anything else is rejected so the server can't be used as an open proxy. |

## Architecture

```
Browser (Next.js client)            GradeBoi server (route handlers)             Edupoint
- all grade + GPA math         ->   POST /api/login       -> AutoAdapter ->   JSON API (StudentVUE (New))
- hypothetical scenarios            POST /api/gradebook        |              /api/v1/mobile/PXPWebServices/*
- prefs / scenarios / seen          POST /api/logout           +-fallback->   legacy SOAP PXPCommunication.asmx
  in localStorage                   GET  /api/districts   ------------------> support.edupoint.com (zip lookup)
```

- `lib/grades/`: pure grade engine (weighted and points-based math, extra credit, letter scale and rounding, GPA, hypothetical scenarios, solver, impacts, history). No UI or network code.
- `lib/studentvue/`: data adapters behind one `GradebookAdapter` interface: `JsonApiAdapter` (primary), `SoapAdapter` (legacy fallback), plus a forgiving parser that maps both the JSON and XML gradebook formats onto one model.
- `lib/ap/`: AP exam catalog + 1–5 score estimator (`exams.ts`), course-name → exam detection (`detect.ts`), and per-college credit estimates (`colleges.ts`).
- `lib/transcript/`: reads transcript PDFs. `extract.ts` rebuilds table rows and cells from pdf.js text positions (text only, size- and page-limited). `parse.ts` finds the printed cumulative GPA — including a Washington/Synergy "Cumulative" summary row whose rightmost number is the GPA — (weighted, unweighted, or unlabeled; cumulative beats per-term), the credit total, and the class rows. Classes are only trusted when they reproduce the printed GPA.
- `lib/demo/`: generates realistic Synergy-format gradebooks (relative to today) for the demo account and the test fixtures.
- `app/api/*`: backend routes (`login`, `gradebook`, `logout`, `districts`, plus `documents` and `documents/[id]`, which stream PDFs with `Cache-Control: private, no-store`, and `transcript`, which reads the transcript's GPA on the server and returns only the numbers). Errors are always `{ error: { code, message } }`. Upstream timeout is 10 s, with one retry on network errors only. Rate limits: 10 logins per IP per 15 minutes, and 30 gradebook calls per session per 15 minutes.
- `proxy.ts`: strict, nonce-based Content Security Policy. `next.config.ts` sets HSTS, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.

### Phase 0 findings (Oct 2026)

The PRD's biggest risk is now confirmed: **Synergy 2027 disabled the legacy SOAP student-data API.** Every `ProcessWebServiceRequest` data call at `wa-nor-psv.edupoint.com` returns `RT_ERROR "This app is deprecated… Error code: D5518-00"`, even before credentials are checked.

GradeBoi therefore uses the **JSON API of the current StudentVUE app** as its primary source (documented by the community at [StudentVue/docs: JSON-API.md](https://github.com/StudentVue/docs/blob/master/JSON-API.md)):

- `AttemptLogin` with HTTP Basic auth returns an opaque access/refresh token pair. The session cookie stores the tokens, **not your password**.
- `Gradebook` returns the same structure as the old XML (`courses[].marks[].assignments[]`), parsed by the same rules.
- On HTTP 401 the server refreshes the tokens once (`RefreshToken`) and writes the new pair back to the cookie.
- Districts without the JSON API (older Synergy versions) fall back to SOAP automatically. In that case only, the encrypted session cookie has to hold the password, because SOAP has no tokens.

Verified live against Northshore: the JSON endpoint is up and answers a bad login with `{"error":{"code":"401","message":"Invalid user id or password"}}` (shown as "Incorrect username or password"), and the zip-code district lookup works.

**Still needs one real login:** the field names inside the JSON gradebook's assignments and weight rows aren't fully published, so the parser matches them case-insensitively against the XML attribute names. Run this once with a real Northshore account:

```bash
SV_USER=<student id> SV_PASS='<password>' npm run phase0
```

It prints counts and field names only (no grades, no password), and checks that your transcript can be downloaded from Documents. To check what GradeBoi reads from your transcript, run it with `SAVE=1` (this saves your transcript to a gitignored local file), then run `npm run transcript:check`. Add `SHOW_LINES=1` to see the raw rows it read. It also answers the PRD's open question about whether Northshore sends category weights. Add `SAVE=1` to save the raw response to a gitignored file for building anonymized fixtures.

## Privacy and security

- Sessions are an encrypted, httpOnly, `Secure` (in production), `SameSite=Strict` cookie that expires after 2 hours. There's no database.
- Logs record the route and status code only. They never include usernames, passwords, bodies, or cookies.
- "Remember me" stores the district and username in `localStorage`, never the password. Past-year grades for the cumulative GPA (`gb:history`) also stay in `localStorage` on your device.
- Documents are fetched from StudentVUE on demand and streamed straight to your browser. They're never stored, and HTML or unknown file types are always downloaded rather than shown inline. Vercel caps function responses at 4.5 MB, so an unusually large PDF could fail to open there.
- Grades live in memory only and are refetched each visit.
- There are no ad or tracking scripts. Analytics (open question in the PRD) isn't installed. If you add it, use a cookieless option.

## Deploying (Vercel)

1. Import the repo into Vercel (framework: Next.js).
2. Set `SESSION_SECRET` (and optionally `ALLOWED_DISTRICT_DOMAINS`) for Production and Preview.
3. Deploy. Pushes to `main` go to production, and pull requests get preview deployments.

Rate limits are in memory per server instance. That's enough to slow down brute force, but not a global guarantee.

## Tech

Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui (Radix), [Animate UI](https://animate-ui.com) (Cursor, Tabs, Gradient Text, Theme Toggler, Management Bar, animated Lucide icons), Motion, fast-xml-parser, iron-session, Vitest, and Playwright. Font: Geist Sans. Palette: Noir Chic (ink black, ivory, champagne gold).
