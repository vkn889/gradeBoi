import { iconImage } from "@/lib/brand/icon-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconImage(180, { maskable: true });
}
