import { parseDistricts, type DistrictResult } from "./parse";
import { soapCall } from "./soap";

// Edupoint's public district lookup (the same one open-source StudentVUE clients use).

export const DISTRICT_LOOKUP_ENDPOINT = "https://support.edupoint.com/Service/HDInfoCommunication.asmx";
const LOOKUP_USER = "EdupointDistrictInfo";
const LOOKUP_PASSWORD = "Edup01nt";
const LOOKUP_KEY = "5E4B7859-B805-474B-A833-FDB15D205D40";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; results: DistrictResult[] }>();

export function isValidZip(zip: unknown): zip is string {
  return typeof zip === "string" && /^\d{5}$/.test(zip);
}

export async function lookupDistricts(zip: string, fetchImpl?: typeof fetch): Promise<DistrictResult[]> {
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;
  const inner = await soapCall(
    DISTRICT_LOOKUP_ENDPOINT,
    {
      userID: LOOKUP_USER,
      password: LOOKUP_PASSWORD,
      webServiceHandleName: "HDInfoServices",
      methodName: "GetMatchingDistrictList",
      paramStr: `<Parms><Key>${LOOKUP_KEY}</Key><MatchToDistrictZipCode>${zip}</MatchToDistrictZipCode></Parms>`,
    },
    { fetchImpl },
  );
  const results = parseDistricts(inner);
  cache.set(zip, { at: Date.now(), results });
  if (cache.size > 5000) cache.clear();
  return results;
}

export function clearDistrictCache() {
  cache.clear();
}
