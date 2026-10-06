import { createHash } from "node:crypto";
import type { Account } from "@/lib/studentvue/adapter";
import { clientIp } from "./rate-limit";
import type { SessionData } from "./session";

/** The adapter account for a signed-in session. */
export function accountFrom(session: SessionData): Account {
  return {
    districtUrl: session.districtUrl ?? "",
    username: session.username ?? "",
    auth: session.auth ?? { kind: "demo" },
  };
}

/**
 * Per-session rate-limit key that never contains the username itself. Demo sessions are keyed
 * by their own random id, so students sharing one school IP don't share a budget.
 */
export function sessionRateKey(session: SessionData, request: Request): string {
  if (session.demo) return `demo:${session.sid ?? clientIp(request)}`;
  return createHash("sha256").update(`${session.districtUrl}\n${session.username}`).digest("hex");
}
