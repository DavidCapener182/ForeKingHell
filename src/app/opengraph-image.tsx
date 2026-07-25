import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LM World Tour — measured golf evidence, turned into decisions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "linear-gradient(135deg, #082d20 0%, #0a5b3a 55%, #91bd68 160%)",
        color: "#f8f6ed",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#d5b15a" }} />
        LM WORLD TOUR
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#cbe09a" }}>
          LAUNCH-MONITOR GOLF, TURNED INTO DECISIONS
        </div>
        <div style={{ fontSize: 76, lineHeight: 0.92, fontWeight: 700 }}>
          Turn every measured shot into a better golf game.
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 25, color: "#e8f1de" }}>
        <span>Traceable evidence</span>
        <span>·</span>
        <span>Trusted bag data</span>
        <span>·</span>
        <span>Smarter practice</span>
      </div>
    </div>,
    size,
  );
}
