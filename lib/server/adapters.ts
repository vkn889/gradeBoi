import { DemoAdapter } from "@/lib/demo/adapter";
import { AutoAdapter, type GradebookAdapter } from "@/lib/studentvue/adapter";
import type { SessionData } from "./session";

/**
 * Picks the data source. The JSON API (current StudentVUE app) is primary with automatic
 * fallback to legacy SOAP; web-portal and Chrome-extension adapters would plug in here behind
 * the same interface (see SRD "Data source strategy").
 */
export function adapterFor(session: Pick<SessionData, "demo">): GradebookAdapter {
  if (session.demo) return new DemoAdapter();
  return new AutoAdapter();
}
