import { adapterFor } from "@/lib/server/adapters";
import { accountFrom, sessionRateKey } from "@/lib/server/account";
import { json, jsonError, logError } from "@/lib/server/http";
import { documentsLimiter } from "@/lib/server/rate-limit";
import { getRouteSession, isLoggedIn } from "@/lib/server/session";
import { StudentVueError } from "@/lib/studentvue/parse";
import { pdfToLines } from "@/lib/transcript/extract";
import { summarizeTranscript } from "@/lib/transcript/parse";
import type { TranscriptResponse } from "@/lib/transcript/types";
import { pickTranscript } from "@/lib/transcript/pick";

const ROUTE = "GET /api/transcript";

/**
 * Finds the student's unofficial transcript in StudentVUE documents, reads the PDF, and returns
 * the GPA printed on it (plus credits and, when verifiable, the classes). Nothing is stored.
 */
export async function GET(request: Request) {
  const headers = new Headers();
  const session = await getRouteSession(request, headers);
  if (!isLoggedIn(session)) return jsonError(401, "SESSION_EXPIRED", "Your session expired. Sign in again.", headers);

  const limit = documentsLimiter.hit(sessionRateKey(session, request));
  if (!limit.ok) {
    headers.set("Retry-After", String(limit.retryAfter));
    return jsonError(429, "RATE_LIMITED", "Too many requests. Wait a few minutes.", headers);
  }

  const adapter = adapterFor(session);
  const reply = (body: TranscriptResponse) => json(body, { headers });

  try {
    const list = await adapter.listDocuments(accountFrom(session));
    if (list.auth) session.auth = list.auth;
    const doc = pickTranscript(list.documents);
    if (!doc) {
      if (list.auth) await session.save();
      return reply({ status: "NOT_POSTED", transcript: null });
    }

    const got = await adapter.getDocument(accountFrom(session), doc.id);
    if (got.auth) session.auth = got.auth;
    if (list.auth || got.auth) await session.save();

    const document = { id: doc.id, name: doc.name, date: doc.date };
    if (got.file.contentType !== "application/pdf") return reply({ status: "UNREADABLE", transcript: null, document });

    let lines;
    try {
      lines = await pdfToLines(got.file.data);
    } catch {
      logError(ROUTE, 200, "UNREADABLE_PDF");
      return reply({ status: "UNREADABLE", transcript: null, document });
    }
    const summary = summarizeTranscript(lines);
    if (summary.gpa.unweighted === null && summary.gpa.weighted === null) {
      // Scanned (image-only) PDFs have no text layer; layouts we can't read land here too.
      logError(ROUTE, 200, lines.length ? "NO_GPA_FOUND" : "NO_TEXT");
      return reply({ status: "NO_GPA", transcript: null, document });
    }
    return reply({ status: "FOUND", transcript: { document, ...summary } });
  } catch (err) {
    if (err instanceof StudentVueError) {
      if (err.code === "BAD_CREDENTIALS") {
        session.destroy();
        return jsonError(401, "SESSION_EXPIRED", "StudentVUE ended your session. Sign in again.", headers);
      }
      if (err.code === "NOT_SUPPORTED") return reply({ status: "NOT_SUPPORTED", transcript: null });
    }
    logError(ROUTE, 502, "UPSTREAM");
    return jsonError(502, "UPSTREAM_ERROR", "Couldn't get your transcript from StudentVUE. Try again in a minute.", headers);
  }
}
