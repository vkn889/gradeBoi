import { ImageResponse } from "next/og";

/** The GradeBoi monogram rendered as a PNG (used for favicon, apple-touch and PWA icons). */
export function iconImage(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const pad = maskable ? size * 0.12 : 0;
  const inner = size - pad * 2;
  const radius = maskable ? 0 : inner * 0.28;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#0b0b0c" : "transparent",
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: radius,
            background: "#0b0b0c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={inner * 0.72} height={inner * 0.72} viewBox="0 0 32 32">
            <path d="M8 26 16 6 24 26" stroke="#f7f5f0" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.4 18.6h9.2" stroke="#c8a96a" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
