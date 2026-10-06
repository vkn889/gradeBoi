import { iconImage } from "@/lib/brand/icon-image";

// PWA manifest icons: /icons/192.png, /icons/512.png, /icons/maskable-512.png
const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[file]">) {
  const { file } = await ctx.params;
  const spec = SIZES[file];
  if (!spec) return new Response("Not found", { status: 404 });
  return iconImage(spec.size, { maskable: spec.maskable });
}
