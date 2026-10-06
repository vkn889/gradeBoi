import { getIronSession, webCookies, type SessionOptions } from "iron-session";
import type { AdapterAuth } from "@/lib/studentvue/adapter";

// Sign-in state is sealed (encrypted + signed) into an httpOnly cookie. Nothing is stored server-side.
// With the JSON API the cookie holds StudentVUE's token pair, not the password; only districts
// still on legacy SOAP need the (encrypted) password because SOAP has no tokens.

export type SessionData = {
  districtUrl?: string;
  username?: string;
  auth?: AdapterAuth;
  studentName?: string;
  /** demo account: no StudentVUE credentials, data comes from the demo generator */
  demo?: boolean;
};

export const SESSION_COOKIE = "gb_session";
export const SESSION_TTL_SECONDS = 2 * 60 * 60;

const DEV_SECRET = "gradeboi-dev-only-secret-change-me-0123456789abcdef";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  return DEV_SECRET;
}

export function sessionOptions(): SessionOptions {
  return {
    password: sessionSecret(),
    cookieName: SESSION_COOKIE,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      // Secure in production; localhost dev runs over http.
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    },
  };
}

/** Session bound to a route handler's Request and the response headers it will return. */
export function getRouteSession(request: Request, responseHeaders: Headers) {
  return getIronSession<SessionData>(webCookies(request, responseHeaders), sessionOptions());
}

export function isLoggedIn(s: SessionData): boolean {
  return Boolean(s.demo || (s.districtUrl && s.username && s.auth));
}

/**
 * Read-only session summary for Server Components. Only non-secret fields leave this function,
 * so credentials can never be passed to a Client Component by accident.
 */
export async function getSessionSummary(): Promise<{ loggedIn: boolean; studentName: string; demo: boolean }> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  try {
    const session = await getIronSession<SessionData>(store, sessionOptions());
    return {
      loggedIn: isLoggedIn(session),
      studentName: session.studentName ?? "",
      demo: Boolean(session.demo),
    };
  } catch {
    return { loggedIn: false, studentName: "", demo: false };
  }
}
