import { ImageResponse } from "next/og";

export const alt = "Tracinhos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const paper = "#f4e8d4";
const ink = "#2b2118";
const bg = "#1a1410";

function Dot() {
  return (
    <div
      style={{
        display: "flex",
        width: 92,
        height: 92,
        borderRadius: 46,
        background: "#fff",
        border: `10px solid ${ink}`,
        boxShadow: `0 0 0 4px ${paper}`,
      }}
    />
  );
}

function Square() {
  const box = 140;
  const stroke = 12;
  const r = 16;
  const mid = stroke / 2;
  return (
    <div style={{ display: "flex", position: "relative", width: box, height: box }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: box,
          height: box,
          border: `${stroke}px solid ${paper}`,
        }}
      />
      {[
        [mid, mid],
        [box - mid, mid],
        [mid, box - mid],
        [box - mid, box - mid],
      ].map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: y,
            left: x,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            background: paper,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

function Stroke() {
  return (
    <div style={{ display: "flex", alignItems: "center", width: 168, height: 140 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: paper,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          height: 14,
          flex: 1,
          background: paper,
          margin: "0 -6px",
        }}
      />
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: paper,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          background: `radial-gradient(1200px 600px at 20% -10%, #2a2018, ${bg})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <Dot />
          <Square />
          <Stroke />
        </div>
      </div>
    ),
    size,
  );
}
