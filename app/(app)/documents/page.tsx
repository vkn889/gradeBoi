import type { Metadata } from "next";
import { Documents } from "@/components/app/documents";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <Documents />;
}
