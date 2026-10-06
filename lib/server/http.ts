import { StudentVueError } from "@/lib/studentvue/parse";
import { UpstreamError } from "@/lib/studentvue/soap";

// JSON helpers. Every error uses { error: { code, message } }.

export function json(data: unknown, init: { status?: number; headers?: Headers } = {}) {
  const headers = init.headers ?? new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status: init.status ?? 200, headers });
}

export function jsonError(status: number, code: string, message: string, headers?: Headers) {
  return json({ error: { code, message } }, { status, headers });
}

/** Logs route + status only. Never usernames, passwords, bodies or cookies. */
export function logError(route: string, status: number, code: string) {
  console.error(`[gradeboi] ${route} -> ${status} ${code}`);
}

/** Maps adapter errors to HTTP responses. */
export function upstreamErrorResponse(route: string, err: unknown, headers?: Headers): Response {
  if (err instanceof StudentVueError) {
    if (err.code === "BAD_CREDENTIALS") {
      return jsonError(401, "BAD_CREDENTIALS", "Incorrect username or password.", headers);
    }
    logError(route, 502, err.code);
    const message =
      err.code === "MALFORMED"
        ? "StudentVUE sent data GradeBoi couldn't read. Try again in a minute."
        : err.code === "DEPRECATED"
          ? "Your district turned off the older StudentVUE connection GradeBoi tried. Try again; if it keeps happening, your district isn't supported yet."
          : err.code === "NOT_SUPPORTED"
            ? "Your school uses a standards-based gradebook, which GradeBoi doesn't support yet."
            : "StudentVUE returned an error. Try again in a minute.";
    return jsonError(502, err.code, message, headers);
  }
  if (err instanceof UpstreamError) {
    if (err.code === "TIMEOUT") {
      logError(route, 504, "TIMEOUT");
      return jsonError(504, "TIMEOUT", "StudentVUE took too long to respond. Try again.", headers);
    }
    logError(route, 502, err.code);
    return jsonError(502, "UPSTREAM_UNREACHABLE", "Couldn't reach your district's StudentVUE server.", headers);
  }
  logError(route, 500, "INTERNAL");
  return jsonError(500, "INTERNAL", "Something went wrong. Try again.", headers);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return {};
    if (text.length > 10_000) return null;
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
