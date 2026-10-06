import type { Metadata } from "next";
import { PastYears } from "@/components/app/past-years";

export const metadata: Metadata = { title: "GPA" };

export default function GpaPage() {
  return <PastYears />;
}
