"use client";

import { useRef, useState, type PointerEvent } from "react";
import { COLOR_HEX, type ColorId, type PublicRoom } from "@tracinhos/shared";

const CELL = 56;
const PAD = 28;
const HIT = 22;

type Edge = { orientation: "h" | "v"; row: number; col: number };

export function Board({
  room,
  canDraw,
  onDraw,
}: {
  room: PublicRoom;
  canDraw: boolean;
  onDraw: (edge: Edge) => void;
}) {
  const game = room.game;
  if (!game) return null;

  const colors = new Map(room.players.map((p) => [p.id, p.color]));
  const size = game.size;
  const width = PAD * 2 + size * CELL;
  const height = width;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
    edge: Edge | null;
  } | null>(null);

  function edgeAt(clientX: number, clientY: number): Edge | null {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left - view.x) / view.scale;
    const y = (clientY - rect.top - view.y) / view.scale;
    let bestEdge: Edge | null = null;
    let bestDist = Infinity;

    const consider = (edge: Edge, cx: number, cy: number, hw: number, hh: number) => {
      const dx = Math.max(Math.abs(x - cx) - hw, 0);
      const dy = Math.max(Math.abs(y - cy) - hh, 0);
      const dist = Math.hypot(dx, dy);
      if (dist > HIT || dist >= bestDist) return;
      bestEdge = edge;
      bestDist = dist;
    };

    for (let row = 0; row <= size; row++) {
      for (let col = 0; col < size; col++) {
        consider(
          { orientation: "h", row, col },
          PAD + col * CELL + CELL / 2,
          PAD + row * CELL,
          CELL / 2,
          HIT / 2,
        );
      }
    }
    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= size; col++) {
        consider(
          { orientation: "v", row, col },
          PAD + col * CELL,
          PAD + row * CELL + CELL / 2,
          HIT / 2,
          CELL / 2,
        );
      }
    }
    return bestEdge;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    wrapRef.current?.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        vx: view.x,
        vy: view.y,
        moved: false,
        edge: edgeAt(event.clientX, event.clientY),
      };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinch.current) pinch.current = { dist, scale: view.scale };
      else {
        const next = Math.max(0.6, Math.min(3, pinch.current.scale * (dist / pinch.current.dist)));
        setView((v) => ({ ...v, scale: next }));
      }
      return;
    }
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.hypot(dx, dy) > 8) drag.current.moved = true;
    if (drag.current.moved) {
      setView((v) => ({ ...v, x: drag.current!.vx + dx, y: drag.current!.vy + dy }));
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }

  function onClick(event: { clientX: number; clientY: number }) {
    if (drag.current?.moved) return;
    const edge = edgeAt(event.clientX, event.clientY);
    if (edge && canDraw) onDraw(edge);
  }

  return (
    <div
      ref={wrapRef}
      className="board-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <svg
        width={width}
        height={height}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {game.owners.map((row, r) =>
          row.map((owner, c) => {
            if (!owner) return null;
            const color = COLOR_HEX[(colors.get(owner) ?? "red") as ColorId];
            return (
              <rect
                key={`q-${r}-${c}`}
                x={PAD + c * CELL}
                y={PAD + r * CELL}
                width={CELL}
                height={CELL}
                fill={color}
                opacity={0.45}
              />
            );
          }),
        )}
        {game.horizontal.map((row, r) =>
          row.map((drawn, c) => (
            <line
              key={`h-${r}-${c}`}
              x1={PAD + c * CELL}
              y1={PAD + r * CELL}
              x2={PAD + (c + 1) * CELL}
              y2={PAD + r * CELL}
              stroke={drawn ? "#2b2118" : "#d8c8b0"}
              strokeWidth={drawn ? 6 : 3}
              strokeLinecap="round"
              aria-label={`traço horizontal linha ${r + 1} coluna ${c + 1}`}
            />
          )),
        )}
        {game.vertical.map((row, r) =>
          row.map((drawn, c) => (
            <line
              key={`v-${r}-${c}`}
              x1={PAD + c * CELL}
              y1={PAD + r * CELL}
              x2={PAD + c * CELL}
              y2={PAD + (r + 1) * CELL}
              stroke={drawn ? "#2b2118" : "#d8c8b0"}
              strokeWidth={drawn ? 6 : 3}
              strokeLinecap="round"
              aria-label={`traço vertical linha ${r + 1} coluna ${c + 1}`}
            />
          )),
        )}
        {Array.from({ length: size + 1 }, (_, r) =>
          Array.from({ length: size + 1 }, (_, c) => (
            <circle
              key={`d-${r}-${c}`}
              cx={PAD + c * CELL}
              cy={PAD + r * CELL}
              r={5}
              fill="#2b2118"
            />
          )),
        )}
      </svg>
    </div>
  );
}
