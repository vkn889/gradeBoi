import type { GradebookAdapter } from "@/lib/studentvue/adapter";
import { StudentVueError, parseGradebook } from "@/lib/studentvue/parse";
import { parseDocumentContent, parseDocumentList } from "@/lib/studentvue/documents";
import { DEMO_STUDENT_NAME, demoGradebookXml } from "./generate";
import { demoDocumentContentData, demoDocumentListData } from "./documents";

/** Demo data source: real StudentVUE-shaped responses run through the real parsers, no network. */
export class DemoAdapter implements GradebookAdapter {
  readonly name = "demo";
  async login() {
    return { studentName: DEMO_STUDENT_NAME, auth: { kind: "demo" as const } };
  }
  async getGradebook(_account: unknown, reportPeriod?: number) {
    return { gradebook: parseGradebook(demoGradebookXml(reportPeriod)) };
  }
  async listDocuments() {
    return { documents: parseDocumentList(demoDocumentListData()) };
  }
  async getDocument(_account: unknown, documentId: string) {
    const data = demoDocumentContentData(documentId);
    if (!data) throw new StudentVueError("MALFORMED", "That document doesn't exist.");
    return { file: parseDocumentContent(data, documentId) };
  }
}
