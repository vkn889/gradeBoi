import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/login/login-screen";
import { getSessionSummary } from "@/lib/server/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSessionSummary();
  if (session.loggedIn) redirect("/dashboard");
  const { expired } = await searchParams;
  return <LoginScreen expired={expired === "1"} />;
}
