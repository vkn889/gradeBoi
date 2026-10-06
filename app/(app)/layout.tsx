import { redirect } from "next/navigation";
import { GradebookProvider } from "@/components/providers/gradebook-provider";
import { AppHeader } from "@/components/app/app-header";
import { getSessionSummary } from "@/lib/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionSummary();
  if (!session.loggedIn) redirect("/");
  return (
    <GradebookProvider studentName={session.studentName} demo={session.demo}>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:px-6">
          {children}
        </main>
      </div>
    </GradebookProvider>
  );
}
