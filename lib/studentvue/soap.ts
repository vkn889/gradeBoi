import { StudentVueError, extractSoapResult } from "./parse";

// Low-level SOAP transport for StudentVUE's PXPCommunication / HDInfoCommunication services.

export const SOAP_ACTION = '"http://edupoint.com/webservices/ProcessWebServiceRequest"';
export const UPSTREAM_TIMEOUT_MS = 10_000;

export class UpstreamError extends Error {
  constructor(
    public code: "TIMEOUT" | "UNREACHABLE" | "HTTP",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** Escapes text for insertion into XML element content. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SoapRequest = {
  userID: string;
  password: string;
  webServiceHandleName: string;
  methodName: string;
  /** raw (unescaped) <Parms> XML; escaped here */
  paramStr: string;
};

export function buildEnvelope(req: SoapRequest): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    "<soap:Body>" +
    '<ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/">' +
    `<userID>${xmlEscape(req.userID)}</userID>` +
    `<password>${xmlEscape(req.password)}</password>` +
    "<skipLoginLog>1</skipLoginLog>" +
    "<parent>0</parent>" +
    `<webServiceHandleName>${xmlEscape(req.webServiceHandleName)}</webServiceHandleName>` +
    `<methodName>${xmlEscape(req.methodName)}</methodName>` +
    `<paramStr>${xmlEscape(req.paramStr)}</paramStr>` +
    "</ProcessWebServiceRequest>" +
    "</soap:Body>" +
    "</soap:Envelope>"
  );
}

type FetchLike = typeof fetch;

export type UpstreamResponse = { status: number; contentType: string; text: string };

/**
 * Fetch with a 10 s timeout. Retries once on a network error only, never on timeouts or
 * HTTP responses (a bad login comes back as HTTP 200 + an error body, handled by callers).
 */
export async function upstreamFetch(
  url: string,
  init: RequestInit,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<UpstreamResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS;

  const attempt = async (): Promise<UpstreamResponse> => {
    const res = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
      cache: "no-store",
    });
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", text: await res.text() };
  };

  try {
    return await attempt();
  } catch (err) {
    if (isTimeout(err)) throw new UpstreamError("TIMEOUT", "StudentVUE took too long to respond.");
    try {
      return await attempt();
    } catch (err2) {
      if (isTimeout(err2)) throw new UpstreamError("TIMEOUT", "StudentVUE took too long to respond.");
      throw new UpstreamError("UNREACHABLE", "Could not reach your district's StudentVUE server.");
    }
  }
}

/** POSTs a SOAP request and returns the unescaped inner result XML. */
export async function soapCall(
  endpoint: string,
  req: SoapRequest,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<string> {
  const res = await upstreamFetch(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: SOAP_ACTION },
      body: buildEnvelope(req),
    },
    opts,
  );
  if (res.status < 200 || res.status >= 300) {
    throw new UpstreamError("HTTP", `StudentVUE responded with HTTP ${res.status}.`, res.status);
  }
  return extractSoapResult(res.text);
}

function isTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError" || /timeout|timed out/i.test(err.message))
  );
}

export { StudentVueError };
