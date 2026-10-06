import { iconImage } from "@/lib/brand/icon-image";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return iconImage(64);
}
