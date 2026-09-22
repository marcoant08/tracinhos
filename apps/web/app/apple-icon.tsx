import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1410",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", width: 118, height: 118 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "#f4e8d4",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              height: 14,
              flex: 1,
              background: "#f4e8d4",
              margin: "0 -6px",
            }}
          />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "#f4e8d4",
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
