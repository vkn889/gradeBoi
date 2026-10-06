import type { Metadata } from "next";
import { ApTools } from "@/components/app/ap";

export const metadata: Metadata = { title: "AP" };

export default function ApPage() {
  return <ApTools />;
}
