// District URL normalization and allow-listing (prevents the server being used as an open proxy).

export const DEFAULT_DISTRICT_URL = "https://wa-nor-psv.edupoint.com";
export const DEFAULT_DISTRICT_NAME = "Northshore School District";

/** Domains always allowed, plus any in ALLOWED_DISTRICT_DOMAINS (comma separated). */
const BUILTIN_DOMAINS = ["edupoint.com"];

export function allowedDomains(env: string | undefined = process.env.ALLOWED_DISTRICT_DOMAINS): string[] {
  const extra = (env ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^\*?\./, ""))
    .filter(Boolean);
  return Array.from(new Set([...BUILTIN_DOMAINS, ...extra]));
}

/**
 * Normalizes a district URL to "https://host": forces https, keeps only the host, and strips
 * paths such as "/PXP2_Login_Student.aspx". Returns null for anything unparseable.
 */
export function normalizeDistrictUrl(input: string): string | null {
  if (typeof input !== "string") return null;
  let raw = input.trim();
  if (!raw || raw.length > 300) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) return null;
  // Reject IP literals outright.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
  if (url.port && url.port !== "443") return null;
  return `https://${host}`;
}

export function isAllowedHost(normalizedUrl: string, domains: string[] = allowedDomains()): boolean {
  let host: string;
  try {
    host = new URL(normalizedUrl).hostname;
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Normalizes and validates; returns null if the district is not allowed. */
export function validateDistrictUrl(input: string, domains?: string[]): string | null {
  const normalized = normalizeDistrictUrl(input);
  if (!normalized) return null;
  return isAllowedHost(normalized, domains) ? normalized : null;
}

export function gradebookEndpoint(districtUrl: string): string {
  return `${districtUrl}/Service/PXPCommunication.asmx`;
}
