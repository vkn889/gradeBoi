import { adapterFor } from "@/lib/server/adapters";
import { json, jsonError, readJson, upstreamErrorResponse } from "@/lib/server/http";
import { clientIp, demoLoginLimiter, loginLimiter } from "@/lib/server/rate-limit";
import { getRouteSession } from "@/lib/server/session";
import { validateDistrictUrl } from "@/lib/studentvue/district";

const ROUTE = "POST /api/login";

export async function POST(request: Request) {
  const headers = new Headers();

  const body = await readJson(request);
  if (!body) return jsonError(400, "BAD_INPUT", "Invalid request.");

  const limiter = body.demo === true ? demoLoginLimiter : loginLimiter;
  const limit = limiter.hit(clientIp(request));
  if (!limit.ok) {
    headers.set("Retry-After", String(limit.retryAfter));
    return jsonError(429, "RATE_LIMITED", "Too many sign-in attempts. Wait a few minutes and try again.", headers);
  }

  if (body.demo === true) {
    const demo = await adapterFor({ demo: true }).login({ districtUrl: "", username: "", password: "" });
    const session = await getRouteSession(request, headers);
    session.demo = true;
    session.sid = crypto.randomUUID();
    session.studentName = demo.studentName ?? "Demo student";
    session.auth = demo.auth;
    delete session.username;
    delete session.districtUrl;
    await session.save();
    return json({ ok: true, studentName: session.studentName }, { headers });
  }

  const { districtUrl, username, password } = body;
  if (
    typeof districtUrl !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password ||
    username.length > 100 ||
    password.length > 200
  ) {
    return jsonError(400, "BAD_INPUT", "Enter your username, password, and district.");
  }

  const district = validateDistrictUrl(districtUrl);
  if (!district) {
    return jsonError(
      400,
      "DISTRICT_NOT_ALLOWED",
      "That district URL isn't supported. Pick your district from the search, or check the address.",
    );
  }

  const creds = { districtUrl: district, username: username.trim(), password };
  let result: Awaited<ReturnType<ReturnType<typeof adapterFor>["login"]>>;
  try {
    result = await adapterFor({}).login(creds);
  } catch (err) {
    return upstreamErrorResponse(ROUTE, err);
  }

  const session = await getRouteSession(request, headers);
  session.demo = false;
  session.districtUrl = creds.districtUrl;
  session.username = creds.username;
  session.auth = result.auth;
  session.studentName = result.studentName ?? creds.username;
  await session.save();

  return json({ ok: true, studentName: session.studentName }, { headers });
}
