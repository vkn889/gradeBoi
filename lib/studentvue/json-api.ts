import type { DocumentFile, Gradebook, StudentDocument } from "@/lib/types";
import { StudentVueError, isCredentialError, parseJsonGradebook } from "./parse";
import { parseDocumentContent, parseDocumentList } from "./documents";
import { UpstreamError, upstreamFetch } from "./soap";

// Client for the JSON API used by the "StudentVUE (New)" app (Synergy 2027+):
//   POST {district}/api/v1/mobile/PXPWebServices/<Method>
// Login is HTTP Basic -> opaque bearer token pair; every call answers HTTP 200 with an
// `error` field in the body. Documented at https://github.com/StudentVue/docs (JSON-API.md).

type FetchLike = typeof fetch;

export const APP_ID = "StudentVUE|Android|1.9.16";

export type JsonTokens = { accessToken: string; refreshToken: string | null };

type Envelope = { error?: { code?: string | number; message?: string } | null; data?: Record<string, unknown> | null };

/** Thrown when the access token was rejected (HTTP 401), so the caller can refresh. */
export class TokenExpiredError extends Error {
  constructor() {
    super("Access token expired");
    this.name = "TokenExpiredError";
  }
}

export function jsonEndpoint(districtUrl: string, method: string) {
  return `${districtUrl}/api/v1/mobile/PXPWebServices/${method}`;
}

function headers(authorization: string) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "ksoap",
    AppNameOSAndVersion: APP_ID,
    Authorization: authorization,
  };
}

/** Wraps request fields the way the API expects: a JSON string at arguments.request. */
export function wrapArgs(request: Record<string, unknown>) {
  return JSON.stringify({ arguments: { request: JSON.stringify(request) } });
}

async function post(
  districtUrl: string,
  method: string,
  authorization: string,
  body: string,
  fetchImpl?: FetchLike,
): Promise<unknown> {
  const res = await upstreamFetch(
    jsonEndpoint(districtUrl, method),
    { method: "POST", headers: headers(authorization), body },
    { fetchImpl },
  );
  if (res.status === 401) throw new TokenExpiredError();
  if (res.status < 200 || res.status >= 300) {
    throw new UpstreamError("HTTP", `StudentVUE responded with HTTP ${res.status}.`, res.status);
  }
  try {
    return JSON.parse(res.text);
  } catch {
    // Older Synergy versions don't have this API (HTML error page); callers fall back to SOAP.
    throw new UpstreamError("HTTP", "StudentVUE did not return JSON.", res.status);
  }
}

function tokensFrom(body: unknown): JsonTokens | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const access = b.access_token ?? b.accessToken;
  if (typeof access !== "string" || !access) return null;
  const refresh = b.refresh_token ?? b.refreshToken;
  return { accessToken: access, refreshToken: typeof refresh === "string" && refresh ? refresh : null };
}

function envelopeError(body: unknown): { code: string; message: string } | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as Envelope).error;
  if (!e) return null;
  return { code: String(e.code ?? ""), message: String(e.message ?? "") };
}

export async function attemptLogin(
  districtUrl: string,
  username: string,
  password: string,
  fetchImpl?: FetchLike,
): Promise<JsonTokens> {
  const basic = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  let body: unknown;
  try {
    body = await post(
      districtUrl,
      "AttemptLogin",
      `Basic ${basic}`,
      wrapArgs({ userID: null, password: null, userType: "Student" }),
      fetchImpl,
    );
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new StudentVueError("BAD_CREDENTIALS", "Incorrect username or password.");
    throw err;
  }
  const tokens = tokensFrom(body);
  if (tokens) return tokens;
  const e = envelopeError(body);
  if (e && (e.code === "401" || isCredentialError(e.message))) {
    throw new StudentVueError("BAD_CREDENTIALS", "Incorrect username or password.");
  }
  if (e) throw new StudentVueError("UPSTREAM_ERROR", e.message || "StudentVUE returned an error.");
  throw new StudentVueError("MALFORMED", "StudentVUE returned an unexpected sign-in response.");
}

export async function refreshTokens(districtUrl: string, refreshToken: string, fetchImpl?: FetchLike): Promise<JsonTokens> {
  let body: unknown;
  try {
    body = await post(districtUrl, "RefreshToken", `Bearer ${refreshToken}`, "{}", fetchImpl);
  } catch (err) {
    if (err instanceof TokenExpiredError) throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    throw err;
  }
  const tokens = tokensFrom(body);
  if (!tokens) throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? refreshToken };
}

/**
 * Calls an authenticated method, refreshing the token pair once on HTTP 401.
 * Returns `data` plus the (possibly refreshed) tokens.
 */
export async function callWithRefresh(
  districtUrl: string,
  method: string,
  request: Record<string, unknown>,
  tokens: JsonTokens,
  fetchImpl?: FetchLike,
): Promise<{ data: Record<string, unknown> | null; error: { code: string; message: string } | null; tokens: JsonTokens }> {
  const run = async (t: JsonTokens) => {
    const body = await post(districtUrl, method, `Bearer ${t.accessToken}`, wrapArgs(request), fetchImpl);
    const data = body && typeof body === "object" ? ((body as Envelope).data ?? null) : null;
    return { data, error: envelopeError(body) };
  };
  try {
    return { ...(await run(tokens)), tokens };
  } catch (err) {
    if (!(err instanceof TokenExpiredError)) throw err;
    if (!tokens.refreshToken) throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    const fresh = await refreshTokens(districtUrl, tokens.refreshToken, fetchImpl);
    try {
      return { ...(await run(fresh)), tokens: fresh };
    } catch (err2) {
      if (err2 instanceof TokenExpiredError) throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
      throw err2;
    }
  }
}

/** Code 2100 = "Grade Book data not available for this school": an empty gradebook, not a failure. */
export const FEATURE_NOT_ENABLED = "2100";

export async function fetchGradebook(
  districtUrl: string,
  tokens: JsonTokens,
  reportPeriod: number | undefined,
  fetchImpl?: FetchLike,
): Promise<{ gradebook: Gradebook; tokens: JsonTokens }> {
  const res = await callWithRefresh(
    districtUrl,
    "Gradebook",
    {
      reportPeriod: reportPeriod === undefined ? "" : String(reportPeriod),
      concurrentSchOrgYearGU: "",
      childIntID: 0,
      languageCode: "en",
    },
    tokens,
    fetchImpl,
  );
  if (res.error) {
    if (res.error.code === FEATURE_NOT_ENABLED) {
      return { gradebook: { reportPeriods: [], currentPeriod: 0, courses: [] }, tokens: res.tokens };
    }
    if (res.error.code === "401" || isCredentialError(res.error.message)) {
      throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    }
    throw new StudentVueError("UPSTREAM_ERROR", res.error.message || "StudentVUE returned an error.");
  }
  const traditional = res.data?.traditionalGradebook ?? res.data?.TraditionalGradebook;
  if (!traditional) {
    if (res.data?.standardsGradebook) {
      throw new StudentVueError("NOT_SUPPORTED", "Standards-based gradebooks aren't supported yet.");
    }
    throw new StudentVueError("MALFORMED", "StudentVUE did not return a gradebook.");
  }
  return { gradebook: parseJsonGradebook(traditional), tokens: res.tokens };
}

/** Best-effort display name from GetChildListData; null on any problem. */
export async function fetchStudentName(districtUrl: string, tokens: JsonTokens, fetchImpl?: FetchLike): Promise<string | null> {
  try {
    const res = await callWithRefresh(
      districtUrl,
      "GetChildListData",
      { legacyAppRequest: false, secondaryLogin: false },
      tokens,
      fetchImpl,
    );
    const children = (res.data?.children as { childInfos?: { name?: unknown }[] } | undefined)?.childInfos;
    const name = children?.[0]?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

function throwForError(error: { code: string; message: string }): never {
  if (error.code === "401" || isCredentialError(error.message)) {
    throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
  }
  throw new StudentVueError("UPSTREAM_ERROR", error.message || "StudentVUE returned an error.");
}

export async function fetchDocumentList(
  districtUrl: string,
  tokens: JsonTokens,
  fetchImpl?: FetchLike,
): Promise<{ documents: StudentDocument[]; tokens: JsonTokens }> {
  const res = await callWithRefresh(districtUrl, "GetStudentDocuments", { childIntID: 0, languageCode: "en" }, tokens, fetchImpl);
  if (res.error) {
    // 2100 = documents not enabled at this school: nothing to show, not a failure.
    if (res.error.code === FEATURE_NOT_ENABLED) return { documents: [], tokens: res.tokens };
    throwForError(res.error);
  }
  return { documents: parseDocumentList(res.data), tokens: res.tokens };
}

export async function fetchDocument(
  districtUrl: string,
  tokens: JsonTokens,
  documentId: string,
  fetchImpl?: FetchLike,
): Promise<{ file: DocumentFile; tokens: JsonTokens }> {
  const res = await callWithRefresh(
    districtUrl,
    "GetStudentDocumentContent",
    { childIntID: 0, documentGU: documentId },
    tokens,
    fetchImpl,
  );
  if (res.error) throwForError(res.error);
  return { file: parseDocumentContent(res.data, documentId), tokens: res.tokens };
}
