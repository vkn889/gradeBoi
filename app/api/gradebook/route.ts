import { createHash } from "node:crypto";
import { adapterFor } from "@/lib/server/adapters";
import { json, jsonError, readJson, upstreamErrorResponse } from "@/lib/server/http";
import { clientIp, gradebookLimiter } from "@/lib/server/rate-limit";
import { getRouteSession, isLoggedIn } from "@/lib/server/session";
import { StudentVueError } from "@/lib/studentvue/parse";

const ROUTE = "POST /api/gradebook";

export async function POST(request: Request) {
  const headers = new Headers();
  const session = await getRouteSession(request, headers);

  if (!isLoggedIn(session)) {
    return jsonError(401, "SESSION_EXPIRED", "Your session expired. Sign in again.", headers);
  }

  const key = session.demo
    ? `demo:${clientIp(request)}`
    : createHash("sha256").update(`${session.districtUrl}\n${session.username}`).digest("hex");
  const limit = gradebookLimiter.hit(key);
  if (!limit.ok) {
    headers.set("Retry-After", String(limit.retryAfter));
    return jsonError(429, "RATE_LIMITED", "You're refreshing too fast. Wait a few minutes.", headers);
  }

  const body = await readJson(request);
  if (!body) return jsonError(400, "BAD_INPUT", "Invalid request.", headers);
  const rp = body.reportPeriod;
  if (rp !== undefined && rp !== null && (typeof rp !== "number" || !Number.isInteger(rp) || rp < 0 || rp > 50)) {
    return jsonError(400, "BAD_INPUT", "Invalid grading period.", headers);
  }

  try {
    const result = await adapterFor(session).getGradebook(
      { districtUrl: session.districtUrl ?? "", username: session.username ?? "", auth: session.auth ?? { kind: "demo" } },
      typeof rp === "number" ? rp : undefined,
    );
    if (result.auth) {
      // StudentVUE rotated the token pair: keep the new one.
      session.auth = result.auth;
      await session.save();
    }
    return json(result.gradebook, { headers });
  } catch (err) {
    if (err instanceof StudentVueError && err.code === "BAD_CREDENTIALS") {
      // Password changed since sign-in: end the session.
      session.destroy();
      return jsonError(401, "SESSION_EXPIRED", "StudentVUE rejected your saved sign-in. Sign in again.", headers);
    }
    return upstreamErrorResponse(ROUTE, err, headers);
  }
}
