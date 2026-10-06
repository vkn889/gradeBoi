import { json } from "@/lib/server/http";
import { getRouteSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const headers = new Headers();
  const session = await getRouteSession(request, headers);
  session.destroy();
  return json({ ok: true }, { headers });
}
