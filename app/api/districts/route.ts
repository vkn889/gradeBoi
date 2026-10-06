import { json, jsonError, logError } from "@/lib/server/http";
import { clientIp, districtLimiter } from "@/lib/server/rate-limit";
import { isValidZip, lookupDistricts } from "@/lib/studentvue/districts";

const ROUTE = "GET /api/districts";

export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip");
  if (!isValidZip(zip)) return jsonError(400, "BAD_ZIP", "Enter a 5-digit zip code.");

  const limit = districtLimiter.hit(clientIp(request));
  if (!limit.ok) {
    const headers = new Headers({ "Retry-After": String(limit.retryAfter) });
    return jsonError(429, "RATE_LIMITED", "Too many searches. Wait a few minutes.", headers);
  }

  try {
    const results = await lookupDistricts(zip);
    return json(results.map(({ name, url, address }) => ({ name, url, address })));
  } catch {
    // Any lookup failure (timeout, unreachable, bad XML) is a 502 per the API contract.
    logError(ROUTE, 502, "LOOKUP_FAILED");
    return jsonError(502, "LOOKUP_FAILED", "District search is unavailable right now. You can paste your district's StudentVUE URL instead.");
  }
}
