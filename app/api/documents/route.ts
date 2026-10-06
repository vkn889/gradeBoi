import { adapterFor } from "@/lib/server/adapters";
import { accountFrom, sessionRateKey } from "@/lib/server/account";
import { json, jsonError, upstreamErrorResponse } from "@/lib/server/http";
import { documentsLimiter } from "@/lib/server/rate-limit";
import { getRouteSession, isLoggedIn } from "@/lib/server/session";
import { StudentVueError } from "@/lib/studentvue/parse";

const ROUTE = "GET /api/documents";

/** Lists the student's StudentVUE documents (transcripts first). */
export async function GET(request: Request) {
  const headers = new Headers();
  const session = await getRouteSession(request, headers);
  if (!isLoggedIn(session)) return jsonError(401, "SESSION_EXPIRED", "Your session expired. Sign in again.", headers);

  const limit = documentsLimiter.hit(sessionRateKey(session, request));
  if (!limit.ok) {
    headers.set("Retry-After", String(limit.retryAfter));
    return jsonError(429, "RATE_LIMITED", "Too many requests. Wait a few minutes.", headers);
  }

  try {
    const result = await adapterFor(session).listDocuments(accountFrom(session));
    if (result.auth) {
      session.auth = result.auth;
      await session.save();
    }
    return json({ documents: result.documents }, { headers });
  } catch (err) {
    if (err instanceof StudentVueError && err.code === "BAD_CREDENTIALS") {
      session.destroy();
      return jsonError(401, "SESSION_EXPIRED", "StudentVUE ended your session. Sign in again.", headers);
    }
    return upstreamErrorResponse(ROUTE, err, headers);
  }
}
