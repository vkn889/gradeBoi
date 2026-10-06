import { adapterFor } from "@/lib/server/adapters";
import { accountFrom, sessionRateKey } from "@/lib/server/account";
import { jsonError, upstreamErrorResponse } from "@/lib/server/http";
import { documentsLimiter } from "@/lib/server/rate-limit";
import { getRouteSession, isLoggedIn } from "@/lib/server/session";
import { INLINE_TYPES, isValidDocumentId } from "@/lib/studentvue/documents";
import { StudentVueError } from "@/lib/studentvue/parse";

const ROUTE = "GET /api/documents/[id]";

/**
 * Streams one document (usually a PDF) from StudentVUE. Shown inline for PDFs/images,
 * downloaded with ?download=1. Never cached: these are private records.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const headers = new Headers();
  const { id } = await ctx.params;
  if (!isValidDocumentId(id)) return jsonError(400, "BAD_INPUT", "Invalid document.");

  const session = await getRouteSession(request, headers);
  if (!isLoggedIn(session)) return jsonError(401, "SESSION_EXPIRED", "Your session expired. Sign in again.", headers);

  const limit = documentsLimiter.hit(sessionRateKey(session, request));
  if (!limit.ok) {
    headers.set("Retry-After", String(limit.retryAfter));
    return jsonError(429, "RATE_LIMITED", "Too many requests. Wait a few minutes.", headers);
  }

  try {
    const { file, auth } = await adapterFor(session).getDocument(accountFrom(session), id);
    if (auth) {
      session.auth = auth;
      await session.save();
    }
    const download = new URL(request.url).searchParams.get("download") === "1" || !INLINE_TYPES.has(file.contentType);
    const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    headers.set("Content-Type", file.contentType);
    headers.set("Content-Length", String(file.data.byteLength));
    headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(file.data as BodyInit, { status: 200, headers });
  } catch (err) {
    if (err instanceof StudentVueError && err.code === "BAD_CREDENTIALS") {
      session.destroy();
      return jsonError(401, "SESSION_EXPIRED", "StudentVUE ended your session. Sign in again.", headers);
    }
    return upstreamErrorResponse(ROUTE, err, headers);
  }
}
