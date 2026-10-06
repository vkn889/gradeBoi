#!/usr/bin/env node
// Phase 0: confirm StudentVUE SOAP access with a real login before trusting the SOAP adapter.
//
//   SV_USER=123456 SV_PASS='...' npm run phase0
//   SV_DISTRICT=https://wa-nor-psv.edupoint.com SV_USER=... SV_PASS=... npm run phase0
//
// Answers the PRD's open questions:
//   1. Which data source works at the district: the JSON API (StudentVUE (New), Synergy 2027+)
//      or the legacy SOAP endpoint?
//   2. Does the district send category weights?
// Prints counts only. Never prints the password or any grades. Optional: SAVE=1 writes the raw
// gradebook XML to tests/fixtures/real-gradebook.local.xml (gitignored) for building fixtures.

import { writeFileSync } from "node:fs";

const district = (process.env.SV_DISTRICT ?? "https://wa-nor-psv.edupoint.com").replace(/\/+$/, "");
const user = process.env.SV_USER;
const pass = process.env.SV_PASS;
if (!user || !pass) {
  console.error("Set SV_USER and SV_PASS (and optionally SV_DISTRICT).");
  process.exit(2);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const unesc = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
    ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[e.toLowerCase()] ??
    String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)),
  );

async function call(methodName, paramStr) {
  const body =
    '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    '<ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/">' +
    `<userID>${esc(user)}</userID><password>${esc(pass)}</password><skipLoginLog>1</skipLoginLog><parent>0</parent>` +
    `<webServiceHandleName>PXPWebServices</webServiceHandleName><methodName>${methodName}</methodName><paramStr>${esc(paramStr)}</paramStr>` +
    "</ProcessWebServiceRequest></soap:Body></soap:Envelope>";
  const started = Date.now();
  const res = await fetch(`${district}/Service/PXPCommunication.asmx`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"http://edupoint.com/webservices/ProcessWebServiceRequest"' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const m = /<ProcessWebServiceRequestResult>([\s\S]*?)<\/ProcessWebServiceRequestResult>/.exec(text);
  return { status: res.status, ms: Date.now() - started, inner: m ? unesc(m[1]) : null, raw: text };
}

async function json(method, authorization, request) {
  const res = await fetch(`${district}/api/v1/mobile/PXPWebServices/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "ksoap", AppNameOSAndVersion: "StudentVUE|Android|1.9.16", Authorization: authorization },
    body: request === null ? "{}" : JSON.stringify({ arguments: { request: JSON.stringify(request) } }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: null };
  }
}

async function tryJsonApi() {
  console.log("\n[1] JSON API (StudentVUE (New))");
  const login = await json("AttemptLogin", `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`, { userID: null, password: null, userType: "Student" });
  if (!login.body) {
    console.log(`    not available (HTTP ${login.status}, non-JSON).`);
    return false;
  }
  if (!login.body.access_token) {
    console.log(`    sign-in failed: ${login.body.error?.code} ${login.body.error?.message}`);
    process.exit(1);
  }
  console.log("    sign-in OK (token received)");
  const gb = await json("Gradebook", `Bearer ${login.body.access_token}`, { reportPeriod: "", concurrentSchOrgYearGU: "", childIntID: 0, languageCode: "en" });
  if (gb.body?.error) {
    console.log(`    Gradebook error: ${gb.body.error.code} ${gb.body.error.message}`);
    process.exit(1);
  }
  const t = gb.body?.data?.traditionalGradebook;
  if (!t) {
    console.log(`    no traditionalGradebook (keys: ${Object.keys(gb.body?.data ?? {}).join(", ")})`);
    process.exit(1);
  }
  const courses = t.courses ?? [];
  const marks = courses.flatMap((c) => c.marks ?? []);
  const assignments = marks.flatMap((m) => m.assignments ?? []);
  const summaries = marks.map((m) => m.gradeCalculationSummary).filter(Boolean);
  const weightRows = summaries.flatMap((x) => (Array.isArray(x) ? x : (x.assignmentGradeCalc ?? Object.values(x).find(Array.isArray) ?? [])))
    .filter((r) => String(r.type ?? r.Type).toUpperCase() !== "TOTAL");
  console.log("RESULT: JSON API works. GradeBoi will use it.");
  console.log(`  reporting periods: ${(t.reportingPeriods ?? []).length}`);
  console.log(`  courses:           ${courses.length}`);
  console.log(`  assignments:       ${assignments.length}`);
  console.log(`  weight rows:       ${weightRows.length} (${weightRows.length ? "district sends category weights" : "NO weights sent; classes treated as points-based"})`);
  // Field names only (no values) so the parser can be checked against the live shape.
  console.log(`  course keys:       ${Object.keys(courses[0] ?? {}).join(", ")}`);
  console.log(`  assignment keys:   ${Object.keys(assignments[0] ?? {}).join(", ")}`);
  console.log(`  weight-row keys:   ${Object.keys(weightRows[0] ?? {}).join(", ")}`);
  if (process.env.SAVE === "1") {
    writeFileSync("tests/fixtures/real-gradebook.local.json", JSON.stringify(t, null, 2));
    console.log("  saved: tests/fixtures/real-gradebook.local.json (anonymize before committing)");
  }
  return true;
}

try {
  console.log(`District: ${district}`);
  if (await tryJsonApi()) process.exit(0);
  console.log("\n[2] Legacy SOAP");
  const r = await call("Gradebook", "<Parms><ChildIntID>0</ChildIntID></Parms>");
  console.log(`HTTP ${r.status} in ${r.ms} ms`);
  if (!r.inner) {
    console.log("RESULT: SOAP endpoint did not return ProcessWebServiceRequestResult.");
    console.log("        -> Build the web-portal adapter (see SRD 'Data source strategy').");
    console.log(r.raw.slice(0, 300).replace(pass, "***"));
    process.exit(1);
  }
  const rt = /<RT_ERROR[^>]*ERROR_MESSAGE="([^"]*)"/.exec(r.inner);
  if (rt) {
    console.log(`RESULT: SOAP endpoint is alive, but returned RT_ERROR: ${rt[1]}`);
    console.log("        -> Neither data source works; the web-portal adapter is the remaining fallback (SRD).");
    process.exit(1);
  }
  const count = (re) => (r.inner.match(re) ?? []).length;
  const calcRows = count(/<AssignmentGradeCalc\b/g);
  const totalRows = count(/<AssignmentGradeCalc\b[^>]*Type="TOTAL"/g);
  console.log("RESULT: SOAP works. GradeBoi will fall back to it for this district.");
  console.log(`  reporting periods: ${count(/<ReportPeriod\b/g)}`);
  console.log(`  courses:           ${count(/<Course\b/g)}`);
  console.log(`  assignments:       ${count(/<Assignment\b/g)}`);
  console.log(`  weight rows:       ${calcRows - totalRows} (${calcRows - totalRows > 0 ? "district sends category weights" : "NO weights sent; classes will be treated as points-based"})`);
  if (process.env.SAVE === "1") {
    writeFileSync("tests/fixtures/real-gradebook.local.xml", r.inner);
    console.log("  saved: tests/fixtures/real-gradebook.local.xml (anonymize before committing)");
  }
} catch (err) {
  console.log(`RESULT: request failed (${err?.name ?? "Error"}). The district may be unreachable from this network.`);
  process.exit(1);
}
