import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/login/route";
import { POST as gradebook } from "@/app/api/gradebook/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as listDocs } from "@/app/api/documents/route";
import { GET as getDoc } from "@/app/api/documents/[id]/route";
import { GET as getTranscript } from "@/app/api/transcript/route";
import { demoTranscriptGpa } from "@/lib/demo/documents";
import { demoDocumentContentData, demoDocumentListData } from "@/lib/demo/documents";
import { GET as districts } from "@/app/api/districts/route";
import { demoGradebookXml, wrapSoapEnvelope } from "@/lib/demo/generate";
import { demoLoginLimiter, documentsLimiter, gradebookLimiter, loginLimiter, districtLimiter } from "@/lib/server/rate-limit";
import { clearDistrictCache } from "@/lib/studentvue/districts";
import { xmlToJsonGradebook } from "../helpers/json-gradebook";

// A mock StudentVUE server speaking both the JSON API (Synergy 2027) and legacy SOAP.
type Mode =
  | "ok"
  | "badLogin"
  | "timeout"
  | "malformed"
  | "networkOnce"
  | "networkAlways"
  | "http500"
  | "noJsonApi" // older district: JSON API 404s, SOAP works
  | "soapDeprecated" // Synergy 2027: SOAP returns D5518
  | "expireOnce" // first Gradebook call 401s; client must refresh
  | "noGradebook" // error 2100
  | "noTranscript"; // documents exist, none is a transcript
let mode: Mode = "ok";
let calls: { url: string; body: string; headers: Record<string, string> }[] = [];
let tokenGen = 1;
let expiredServed = false;

const GOOD_USER = "123456";
const GOOD_PASS = "c0rrect&horse";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function mockServer(url: string, init: RequestInit): Promise<Response> {
  const body = String(init.body ?? "");
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  calls.push({ url, body, headers });
  if (mode === "timeout") {
    const e = new Error("The operation was aborted due to timeout");
    e.name = "TimeoutError";
    return Promise.reject(e);
  }
  if (mode === "networkAlways" || (mode === "networkOnce" && calls.length === 1)) {
    return Promise.reject(new TypeError("fetch failed"));
  }
  if (mode === "http500") return Promise.resolve(new Response("oops", { status: 500 }));
  if (mode === "malformed") return Promise.resolve(new Response("<html>maintenance</html>", { status: 200 }));

  if (url.includes("HDInfoCommunication")) {
    return Promise.resolve(
      new Response(
        wrapSoapEnvelope(
          '<DistrictLists><DistrictInfos><DistrictInfo DistrictID="1" Name="Northshore School District" Address="Bothell WA" PvueURL="https://wa-nor-psv.edupoint.com" /></DistrictInfos></DistrictLists>',
        ),
      ),
    );
  }

  // --- JSON API ---
  const jsonMethod = /\/api\/v1\/mobile\/PXPWebServices\/(\w+)$/.exec(url)?.[1];
  if (jsonMethod) {
    if (mode === "noJsonApi") return Promise.resolve(new Response("<html>Not Found</html>", { status: 404 }));
    const auth = headers["authorization"] ?? "";
    if (jsonMethod === "AttemptLogin") {
      const [u, ...rest] = Buffer.from(auth.replace(/^Basic /, ""), "base64").toString("utf8").split(":");
      if (mode === "badLogin" || u !== GOOD_USER || rest.join(":") !== GOOD_PASS) {
        return Promise.resolve(jsonRes({ error: { code: "401", message: "Invalid user id or password", stackTrace: null }, data: null }));
      }
      tokenGen = 1;
      return Promise.resolve(jsonRes({ access_token: "AT1", refresh_token: "RT1", token_type: null, expires_in: null, scope: null }));
    }
    if (jsonMethod === "RefreshToken") {
      if (auth !== `Bearer RT${tokenGen}`) return Promise.resolve(new Response("", { status: 401 }));
      tokenGen += 1;
      return Promise.resolve(jsonRes({ access_token: `AT${tokenGen}`, refresh_token: `RT${tokenGen}` }));
    }
    if (mode === "expireOnce" && jsonMethod === "Gradebook" && !expiredServed) {
      expiredServed = true;
      return Promise.resolve(new Response("", { status: 401 }));
    }
    if (auth !== `Bearer AT${tokenGen}`) return Promise.resolve(new Response("", { status: 401 }));
    if (mode === "badLogin") {
      return Promise.resolve(jsonRes({ error: { code: "401", message: "Invalid user id or password" }, data: null }));
    }
    const request = JSON.parse(JSON.parse(body).arguments.request);
    if (jsonMethod === "GetChildListData") {
      return Promise.resolve(jsonRes({ error: null, data: { children: { childInfos: [{ childIntID: 0, name: "Jamie Lee" }] } } }));
    }
    if (jsonMethod === "GetStudentDocuments") {
      const data = demoDocumentListData();
      if (mode === "noTranscript") {
        data.studentDocuments.studentDocumentDatas = data.studentDocuments.studentDocumentDatas.filter(
          (d) => d.documentType !== "Transcript",
        );
      }
      return Promise.resolve(jsonRes({ error: null, data }));
    }
    if (jsonMethod === "GetStudentDocumentContent") {
      const data = demoDocumentContentData(request.documentGU);
      return Promise.resolve(
        data ? jsonRes({ error: null, data }) : jsonRes({ error: { code: "500", message: "Document not found" }, data: null }),
      );
    }
    if (jsonMethod === "Gradebook") {
      if (mode === "noGradebook") {
        return Promise.resolve(jsonRes({ error: { code: "2100", message: "Grade Book data not available for this school" }, data: null }));
      }
      const rp = request.reportPeriod === "" ? undefined : Number(request.reportPeriod);
      return Promise.resolve(
        jsonRes({ error: null, data: { traditionalGradebook: xmlToJsonGradebook(demoGradebookXml(rp)), standardsGradebook: null } }),
      );
    }
    return Promise.resolve(jsonRes({ error: { code: "500", message: "unknown method" }, data: null }));
  }

  // --- legacy SOAP ---
  if (mode === "soapDeprecated") {
    return Promise.resolve(
      new Response(
        wrapSoapEnvelope(
          '<RT_ERROR ERROR_MESSAGE="This app is deprecated. To continue, please download StudentVUE (New). Error code: D5518-00." />',
        ),
      ),
    );
  }
  const user = /<userID>(.*?)<\/userID>/.exec(body)?.[1];
  const pass = /<password>(.*?)<\/password>/.exec(body)?.[1];
  if (user !== GOOD_USER || pass !== "c0rrect&amp;horse") {
    return Promise.resolve(
      new Response(wrapSoapEnvelope('<RT_ERROR ERROR_MESSAGE="Invalid user id or password"><STACK_TRACE /></RT_ERROR>')),
    );
  }
  const method = /<methodName>(.*?)<\/methodName>/.exec(body)?.[1];
  if (method === "StudentInfo") {
    return Promise.resolve(new Response(wrapSoapEnvelope("<StudentInfo><FormattedName>Jamie Lee</FormattedName></StudentInfo>")));
  }
  const rp = /&lt;ReportPeriod&gt;(\d+)&lt;\/ReportPeriod&gt;/.exec(body)?.[1];
  return Promise.resolve(new Response(wrapSoapEnvelope(demoGradebookXml(rp ? Number(rp) : undefined))));
}

const req = (path: string, body?: unknown, cookie?: string, ip = "1.2.3.4") =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const cookieFrom = (res: Response) => {
  const sc = res.headers.get("set-cookie") ?? "";
  return sc.split(";")[0];
};

const goodLogin = { districtUrl: "wa-nor-psv.edupoint.com/PXP2_Login_Student.aspx", username: GOOD_USER, password: GOOD_PASS };

beforeEach(() => {
  mode = "ok";
  calls = [];
  tokenGen = 1;
  expiredServed = false;
  loginLimiter.reset();
  demoLoginLimiter.reset();
  documentsLimiter.reset();
  gradebookLimiter.reset();
  districtLimiter.reset();
  clearDistrictCache();
  vi.stubGlobal("fetch", vi.fn(mockServer));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/login", () => {
  it("signs in via the JSON API, sets an httpOnly SameSite=Strict cookie, and never echoes the password", async () => {
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, studentName: "Jamie Lee" });
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toMatch(/gb_session=/);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(sc).not.toContain(GOOD_PASS);
    expect(calls[0].url).toBe("https://wa-nor-psv.edupoint.com/api/v1/mobile/PXPWebServices/AttemptLogin");
    expect(calls[0].headers["authorization"]).toBe(`Basic ${Buffer.from(`${GOOD_USER}:${GOOD_PASS}`).toString("base64")}`);
    expect(calls[0].headers["user-agent"]).toBe("ksoap");
    expect(calls[0].headers["appnameosandversion"]).toMatch(/^StudentVUE\|Android\|/);
    // Credentials only travel in the Authorization header.
    expect(calls[0].body).not.toContain(GOOD_USER);
    expect(JSON.parse(JSON.parse(calls[0].body).arguments.request)).toEqual({ userID: null, password: null, userType: "Student" });
  });

  it("does not keep the password in the session for JSON-API districts", async () => {
    const { unsealData } = await import("iron-session");
    const { sessionSecret } = await import("@/lib/server/session");
    const res = await login(req("/api/login", goodLogin));
    const seal = decodeURIComponent(cookieFrom(res).split("=").slice(1).join("="));
    const data = await unsealData<Record<string, unknown>>(seal, { password: sessionSecret() });
    expect(JSON.stringify(data)).not.toContain(GOOD_PASS);
    expect(data.auth).toEqual({ kind: "json", accessToken: "AT1", refreshToken: "RT1" });
  });

  it("falls back to legacy SOAP when the district has no JSON API", async () => {
    mode = "noJsonApi";
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(200);
    const soap = calls.find((c) => c.url.endsWith("/Service/PXPCommunication.asmx"))!;
    expect(soap.headers["soapaction"]).toBe('"http://edupoint.com/webservices/ProcessWebServiceRequest"');
    expect(soap.headers["content-type"]).toBe("text/xml; charset=utf-8");
    const cookie = cookieFrom(res);
    const gb = await gradebook(req("/api/gradebook", {}, cookie));
    expect(gb.status).toBe(200);
    expect((await gb.json()).courses.length).toBeGreaterThan(3);
  });

  it("explains Synergy 2027's SOAP deprecation instead of blaming the password", async () => {
    mode = "noJsonApi";
    const prev = mode;
    // JSON missing + SOAP deprecated: nothing works for this district.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        if (url.includes("/api/v1/")) return Promise.resolve(new Response("nope", { status: 404 }));
        mode = "soapDeprecated";
        const r = mockServer(url, init);
        mode = prev;
        return r;
      }),
    );
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("DEPRECATED");
  });

  it("returns 401 for bad credentials", async () => {
    const res = await login(req("/api/login", { ...goodLogin, password: "wrong" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("BAD_CREDENTIALS");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 400 for bad input and disallowed districts", async () => {
    expect((await login(req("/api/login", { username: "x" }))).status).toBe(400);
    const res = await login(req("/api/login", { ...goodLogin, districtUrl: "https://evil.example.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("DISTRICT_NOT_ALLOWED");
    expect(calls).toHaveLength(0);
    const bad = new Request("http://localhost/api/login", { method: "POST", body: "{nope" });
    // Malformed bodies are rejected before any upstream call.
    expect((await login(bad)).status).toBe(400);
  });

  it("returns 502 when the district is unreachable (after one retry)", async () => {
    mode = "networkAlways";
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(502);
    expect(calls).toHaveLength(2);
  });

  it("retries once on a network error and succeeds", async () => {
    mode = "networkOnce";
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(200);
    expect(calls[0].url).toBe(calls[1].url);
  });

  it("does not retry on 401 or timeout", async () => {
    await login(req("/api/login", { ...goodLogin, password: "wrong" }));
    expect(calls).toHaveLength(1);
    calls = [];
    mode = "timeout";
    const res = await login(req("/api/login", goodLogin));
    expect(res.status).toBe(504);
    expect(calls).toHaveLength(1);
  });

  it("returns 502 for malformed XML and HTTP errors", async () => {
    mode = "malformed";
    expect((await login(req("/api/login", goodLogin))).status).toBe(502);
    mode = "http500";
    expect((await login(req("/api/login", goodLogin))).status).toBe(502);
  });

  it("rate-limits to 10 attempts per IP per 15 minutes", async () => {
    for (let i = 0; i < 10; i++) await login(req("/api/login", { ...goodLogin, password: "wrong" }, undefined, "9.9.9.9"));
    const res = await login(req("/api/login", goodLogin, undefined, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await login(req("/api/login", goodLogin, undefined, "8.8.8.8"))).status).toBe(200);
  });

  it("never logs usernames or passwords", async () => {
    const spy = vi.spyOn(console, "error");
    mode = "malformed";
    await login(req("/api/login", goodLogin));
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain(GOOD_USER);
    expect(logged).not.toContain(GOOD_PASS);
  });
});

describe("POST /api/gradebook", () => {
  it("returns 401 without a session", async () => {
    const res = await gradebook(req("/api/gradebook", {}));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("SESSION_EXPIRED");
  });

  it("returns gradebook JSON using session credentials", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    calls = [];
    const res = await gradebook(req("/api/gradebook", {}, cookie));
    expect(res.status).toBe(200);
    const gb = await res.json();
    expect(gb.courses.length).toBeGreaterThan(3);
    expect(gb.reportPeriods.length).toBe(4);
    expect(gb.currentPeriod).toBe(1);
    expect(calls[0].url).toMatch(/PXPWebServices\/Gradebook$/);
    expect(calls[0].headers["authorization"]).toBe("Bearer AT1");
    expect(JSON.parse(JSON.parse(calls[0].body).arguments.request)).toMatchObject({ reportPeriod: "", childIntID: 0 });
  });

  it("passes reportPeriod through", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    calls = [];
    const res = await gradebook(req("/api/gradebook", { reportPeriod: 0 }, cookie));
    expect(res.status).toBe(200);
    expect(JSON.parse(JSON.parse(calls[0].body).arguments.request).reportPeriod).toBe("0");
    expect((await gradebook(req("/api/gradebook", { reportPeriod: "x" }, cookie))).status).toBe(400);
  });

  it("maps upstream timeout to 504 and errors to 502", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "timeout";
    expect((await gradebook(req("/api/gradebook", {}, cookie))).status).toBe(504);
    mode = "malformed";
    expect((await gradebook(req("/api/gradebook", {}, cookie))).status).toBe(502);
  });

  it("expires the session when StudentVUE rejects the stored password", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "badLogin";
    const res = await gradebook(req("/api/gradebook", {}, cookie));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("refreshes an expired access token once and saves the new pair", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "expireOnce";
    calls = [];
    const res = await gradebook(req("/api/gradebook", {}, cookie));
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["Gradebook", "RefreshToken", "Gradebook"]);
    expect(calls[1].headers["authorization"]).toBe("Bearer RT1");
    expect(calls[2].headers["authorization"]).toBe("Bearer AT2");
    // The rotated tokens are written back into the cookie.
    const newCookie = cookieFrom(res);
    expect(newCookie).toMatch(/^gb_session=/);
    mode = "ok";
    calls = [];
    expect((await gradebook(req("/api/gradebook", {}, newCookie))).status).toBe(200);
    expect(calls[0].headers["authorization"]).toBe("Bearer AT2");
  });

  it("treats 'gradebook not available' (2100) as an empty gradebook", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "noGradebook";
    const res = await gradebook(req("/api/gradebook", {}, cookie));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reportPeriods: [], currentPeriod: 0, courses: [] });
  });

  it("rate-limits to 30 calls per session per 15 minutes", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    for (let i = 0; i < 30; i++) expect((await gradebook(req("/api/gradebook", {}, cookie))).status).toBe(200);
    expect((await gradebook(req("/api/gradebook", {}, cookie))).status).toBe(429);
  });

  it("works for the demo account without any network", async () => {
    const lr = await login(req("/api/login", { demo: true }));
    expect(lr.status).toBe(200);
    const res = await gradebook(req("/api/gradebook", {}, cookieFrom(lr)));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("rejects a tampered cookie", async () => {
    const res = await gradebook(req("/api/gradebook", {}, "gb_session=Fe26.2**garbage"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/logout", () => {
  it("clears the cookie", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    const res = await logout(req("/api/logout", undefined, cookie));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toMatch(/gb_session=;/);
  });
});

describe("GET /api/districts", () => {
  const get = (q: string) => districts(new Request(`http://localhost/api/districts${q}`, { headers: { "x-forwarded-for": "5.5.5.5" } }));
  it("validates zip", async () => {
    expect((await get("?zip=123")).status).toBe(400);
    expect((await get("")).status).toBe(400);
  });
  it("returns districts and caches for 24h", async () => {
    const res = await get("?zip=98011");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: "Northshore School District", url: "https://wa-nor-psv.edupoint.com", address: "Bothell WA" },
    ]);
    await get("?zip=98011");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toContain("&lt;MatchToDistrictZipCode&gt;98011&lt;/MatchToDistrictZipCode&gt;");
  });
  it("returns 502 when the lookup fails", async () => {
    mode = "malformed";
    expect((await get("?zip=98012")).status).toBe(502);
  });
});

describe("documents", () => {
  const TRANSCRIPT = "6F1D2C1A-0D5E-4C1B-9A55-7F0D8E3A1B01";
  const get = (path: string, cookie?: string) =>
    new Request(`http://localhost${path}`, { headers: { "x-forwarded-for": "1.2.3.4", ...(cookie ? { cookie } : {}) } });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("requires a session", async () => {
    expect((await listDocs(get("/api/documents"))).status).toBe(401);
    expect((await getDoc(get(`/api/documents/${TRANSCRIPT}`), ctx(TRANSCRIPT))).status).toBe(401);
  });

  it("lists documents from the JSON API with transcripts first", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    calls = [];
    const res = await listDocs(get("/api/documents", cookie));
    expect(res.status).toBe(200);
    const { documents } = await res.json();
    expect(documents[0]).toMatchObject({ id: TRANSCRIPT, isTranscript: true, type: "Transcript" });
    expect(calls[0].url).toMatch(/PXPWebServices\/GetStudentDocuments$/);
    expect(JSON.parse(JSON.parse(calls[0].body).arguments.request)).toEqual({ childIntID: 0, languageCode: "en" });
  });

  it("streams a PDF inline, or as a download, never cached", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    const res = await getDoc(get(`/api/documents/${TRANSCRIPT}`, cookie), ctx(TRANSCRIPT));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="Transcript.pdf"/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    const dl = await getDoc(get(`/api/documents/${TRANSCRIPT}?download=1`, cookie), ctx(TRANSCRIPT));
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("rejects bad ids before calling StudentVUE and maps upstream errors", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    calls = [];
    expect((await getDoc(get("/api/documents/x", cookie), ctx("../../etc"))).status).toBe(400);
    expect(calls).toHaveLength(0);
    expect((await getDoc(get("/api/documents/NOPE-1", cookie), ctx("NOPE-1"))).status).toBe(502);
  });

  it("works for the demo account with no network", async () => {
    const cookie = cookieFrom(await login(req("/api/login", { demo: true })));
    calls = [];
    const res = await listDocs(get("/api/documents", cookie));
    expect((await res.json()).documents).toHaveLength(4);
    expect((await getDoc(get(`/api/documents/${TRANSCRIPT}`, cookie), ctx(TRANSCRIPT))).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("explains that legacy SOAP districts don't have documents", async () => {
    mode = "noJsonApi";
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    const res = await listDocs(get("/api/documents", cookie));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("NOT_SUPPORTED");
  });
});

describe("GET /api/transcript", () => {
  const get = (cookie?: string) =>
    new Request("http://localhost/api/transcript", { headers: { "x-forwarded-for": "1.2.3.4", ...(cookie ? { cookie } : {}) } });

  it("requires a session", async () => {
    expect((await getTranscript(get())).status).toBe(401);
  });

  it("finds the unofficial transcript in StudentVUE documents and reads its GPA", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    calls = [];
    const res = await getTranscript(get(cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    const expected = demoTranscriptGpa();
    expect(body.status).toBe("FOUND");
    expect(body.transcript.gpa).toEqual({ unweighted: expected.unweighted, weighted: expected.weighted, credits: expected.credits });
    expect(body.transcript.coursesVerified).toBe(true);
    expect(body.transcript.document.name).toBe("Unofficial Transcript");
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["GetStudentDocuments", "GetStudentDocumentContent"]);
  });

  it("reports when no transcript is posted", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "noTranscript";
    expect(await (await getTranscript(get(cookie))).json()).toEqual({ status: "NOT_POSTED", transcript: null });
  });

  it("works for the demo account and reports legacy districts as unsupported", async () => {
    const demo = cookieFrom(await login(req("/api/login", { demo: true })));
    expect((await (await getTranscript(get(demo))).json()).status).toBe("FOUND");
    mode = "noJsonApi";
    const soap = cookieFrom(await login(req("/api/login", goodLogin)));
    expect(await (await getTranscript(get(soap))).json()).toEqual({ status: "NOT_SUPPORTED", transcript: null });
  });

  it("returns 502 when StudentVUE fails", async () => {
    const cookie = cookieFrom(await login(req("/api/login", goodLogin)));
    mode = "http500";
    expect((await getTranscript(get(cookie))).status).toBe(502);
  });
});

describe("demo rate limits", () => {
  it("are per demo session, not per IP", async () => {
    const a = cookieFrom(await login(req("/api/login", { demo: true })));
    const b = cookieFrom(await login(req("/api/login", { demo: true })));
    for (let i = 0; i < 30; i++) expect((await gradebook(req("/api/gradebook", {}, a))).status).toBe(200);
    expect((await gradebook(req("/api/gradebook", {}, a))).status).toBe(429);
    // Another demo user on the same IP still has their own budget.
    expect((await gradebook(req("/api/gradebook", {}, b))).status).toBe(200);
  });
});
