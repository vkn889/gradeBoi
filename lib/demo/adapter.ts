import type { GradebookAdapter } from "@/lib/studentvue/adapter";
import { parseGradebook } from "@/lib/studentvue/parse";
import { DEMO_STUDENT_NAME, demoGradebookXml } from "./generate";

/** Demo data source: real Synergy-shaped XML run through the real parser, no network. */
export class DemoAdapter implements GradebookAdapter {
  readonly name = "demo";
  async login() {
    return { studentName: DEMO_STUDENT_NAME, auth: { kind: "demo" as const } };
  }
  async getGradebook(_account: unknown, reportPeriod?: number) {
    return { gradebook: parseGradebook(demoGradebookXml(reportPeriod)) };
  }
}
