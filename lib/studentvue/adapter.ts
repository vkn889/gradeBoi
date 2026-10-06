import type { DocumentFile, Gradebook, StudentDocument } from "@/lib/types";
import { StudentVueError, parseGradebook, parseStudentName } from "./parse";
import { UpstreamError, soapCall } from "./soap";
import { gradebookEndpoint } from "./district";
import { attemptLogin, fetchDocument, fetchDocumentList, fetchGradebook, fetchStudentName, type JsonTokens } from "./json-api";

/**
 * Every data source (JSON API, legacy SOAP, web portal, Chrome extension) implements this
 * interface so the UI and grade engine never depend on where grades come from.
 */
export type Credentials = { districtUrl: string; username: string; password: string };

/**
 * What the session keeps between requests. For the JSON API this is a token pair, so the
 * password is not needed after sign-in. Legacy SOAP has no tokens and needs the password.
 */
export type AdapterAuth =
  | { kind: "json"; accessToken: string; refreshToken: string | null }
  | { kind: "soap"; password: string }
  | { kind: "demo" };

export type Account = { districtUrl: string; username: string; auth: AdapterAuth };

export interface GradebookAdapter {
  readonly name: string;
  /** Validates credentials. Throws StudentVueError("BAD_CREDENTIALS") on a bad login. */
  login(creds: Credentials): Promise<{ studentName: string | null; auth: AdapterAuth }>;
  /** Fetches and parses a gradebook; omit reportPeriod for the current one. Returns refreshed auth if it changed. */
  getGradebook(account: Account, reportPeriod?: number): Promise<{ gradebook: Gradebook; auth?: AdapterAuth }>;
  /** Documents published in StudentVUE (transcripts, report cards, letters). */
  listDocuments(account: Account): Promise<{ documents: StudentDocument[]; auth?: AdapterAuth }>;
  getDocument(account: Account, documentId: string): Promise<{ file: DocumentFile; auth?: AdapterAuth }>;
}

const notSupported = () =>
  new StudentVueError("NOT_SUPPORTED", "Documents aren't available for your district's StudentVUE version yet.");

type FetchLike = typeof fetch;

export function gradebookParams(reportPeriod?: number): string {
  const rp =
    reportPeriod !== undefined && Number.isInteger(reportPeriod) && reportPeriod >= 0
      ? `<ReportPeriod>${reportPeriod}</ReportPeriod>`
      : "";
  return `<Parms><ChildIntID>0</ChildIntID>${rp}</Parms>`;
}

/** Primary: the JSON API used by the current StudentVUE app (Synergy 2027+). */
export class JsonApiAdapter implements GradebookAdapter {
  readonly name = "json";
  constructor(private fetchImpl?: FetchLike) {}

  async login(creds: Credentials) {
    const tokens = await attemptLogin(creds.districtUrl, creds.username, creds.password, this.fetchImpl);
    const studentName = await fetchStudentName(creds.districtUrl, tokens, this.fetchImpl);
    return { studentName, auth: { kind: "json" as const, ...tokens } };
  }

  async getGradebook(account: Account, reportPeriod?: number) {
    if (account.auth.kind !== "json") throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    const { accessToken, refreshToken } = account.auth;
    const res = await fetchGradebook(account.districtUrl, { accessToken, refreshToken }, reportPeriod, this.fetchImpl);
    const changed = res.tokens.accessToken !== accessToken || res.tokens.refreshToken !== refreshToken;
    return { gradebook: res.gradebook, auth: changed ? { kind: "json" as const, ...res.tokens } : undefined };
  }

  private tokens(account: Account): JsonTokens {
    if (account.auth.kind !== "json") throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    return { accessToken: account.auth.accessToken, refreshToken: account.auth.refreshToken };
  }

  private rotated(before: JsonTokens, after: JsonTokens): AdapterAuth | undefined {
    const changed = before.accessToken !== after.accessToken || before.refreshToken !== after.refreshToken;
    return changed ? { kind: "json", ...after } : undefined;
  }

  async listDocuments(account: Account) {
    const t = this.tokens(account);
    const res = await fetchDocumentList(account.districtUrl, t, this.fetchImpl);
    return { documents: res.documents, auth: this.rotated(t, res.tokens) };
  }

  async getDocument(account: Account, documentId: string) {
    const t = this.tokens(account);
    const res = await fetchDocument(account.districtUrl, t, documentId, this.fetchImpl);
    return { file: res.file, auth: this.rotated(t, res.tokens) };
  }
}

/** Legacy SOAP API (PXPCommunication.asmx). Disabled for student data on Synergy 2027 districts. */
export class SoapAdapter implements GradebookAdapter {
  readonly name = "soap";
  constructor(private fetchImpl?: FetchLike) {}

  private call(districtUrl: string, username: string, password: string, methodName: string, paramStr: string) {
    return soapCall(
      gradebookEndpoint(districtUrl),
      { userID: username, password, webServiceHandleName: "PXPWebServices", methodName, paramStr },
      { fetchImpl: this.fetchImpl },
    );
  }

  async login(creds: Credentials) {
    const inner = await this.call(
      creds.districtUrl,
      creds.username,
      creds.password,
      "StudentInfo",
      "<Parms><ChildIntID>0</ChildIntID></Parms>",
    );
    // parseStudentName throws BAD_CREDENTIALS / DEPRECATED on RT_ERROR.
    return { studentName: parseStudentName(inner), auth: { kind: "soap" as const, password: creds.password } };
  }

  async getGradebook(account: Account, reportPeriod?: number) {
    if (account.auth.kind !== "soap") throw new StudentVueError("BAD_CREDENTIALS", "Session expired.");
    const inner = await this.call(
      account.districtUrl,
      account.username,
      account.auth.password,
      "Gradebook",
      gradebookParams(reportPeriod),
    );
    return { gradebook: parseGradebook(inner) };
  }

  // Legacy SOAP districts: StudentVUE's newer document calls aren't available.
  async listDocuments(): Promise<{ documents: StudentDocument[] }> {
    throw notSupported();
  }

  async getDocument(): Promise<{ file: DocumentFile }> {
    throw notSupported();
  }
}

/** True when the district doesn't have the JSON API at all (older Synergy): fall back to SOAP. */
function jsonApiMissing(err: unknown): boolean {
  return err instanceof UpstreamError && err.code === "HTTP";
}

/**
 * Picks the data source per district: JSON API first; if the district has no JSON API
 * (404 / HTML instead of JSON), the legacy SOAP API. After sign-in, the session's auth kind
 * decides which adapter serves the gradebook.
 */
export class AutoAdapter implements GradebookAdapter {
  readonly name = "auto";
  private json: JsonApiAdapter;
  private soap: SoapAdapter;
  constructor(fetchImpl?: FetchLike) {
    this.json = new JsonApiAdapter(fetchImpl);
    this.soap = new SoapAdapter(fetchImpl);
  }

  async login(creds: Credentials) {
    try {
      return await this.json.login(creds);
    } catch (err) {
      if (!jsonApiMissing(err)) throw err;
      return this.soap.login(creds);
    }
  }

  private pick(account: Account): GradebookAdapter {
    return account.auth.kind === "soap" ? this.soap : this.json;
  }

  getGradebook(account: Account, reportPeriod?: number) {
    return this.pick(account).getGradebook(account, reportPeriod);
  }

  listDocuments(account: Account) {
    return this.pick(account).listDocuments(account);
  }

  getDocument(account: Account, documentId: string) {
    return this.pick(account).getDocument(account, documentId);
  }
}
