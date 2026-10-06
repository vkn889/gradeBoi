import type { Metadata } from "next";
import { ClassView } from "@/components/class/class-view";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: PageProps<"/class/[id]">) {
  const { id } = await params;
  return <ClassView courseId={decodeURIComponent(id)} />;
}
