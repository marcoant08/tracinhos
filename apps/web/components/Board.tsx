"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { GameState } from "@tracinhos/game";
import { COLOR_HEX, type ColorId, type PublicRoom } from "@tracinhos/shared";

const CELL = 56;
const PAD = 28;
const DOT_HIT = 24;

type Edge = { orientation: "h" | "v"; row: number; col: number };
type Point = { row: number; col: number };

export function Board({
  room,
  canDraw,
  onDraw,
}: {
  room: PublicRoom;
  canDraw: boolean;
  onDraw: (edge: Edge) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selected, setSelected] = useState<Point | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  );

  const game = room.game;

  useEffect(() => {
    if (!canDraw) setSelected(null);
  }, [canDraw]);

  if (!game) return null;
  const board: GameState = game;

  const colors = new Map(room.players.map((p) => [p.id, p.color]));
  const size = board.size;
  const dots = size + 1;
  const width = PAD * 2 + size * CELL;
  const height = width;
  const targets = selected ? freeNeighbors(board, selected) : [];

  function toLocal(clientX: number, clientY: number) {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }

  function pointAt(clientX: number, clientY: number): Point | null {
    const local = toLocal(clientX, clientY);
    if (!local) return null;
    let best: Point | null = null;
    let bestDist = DOT_HIT;
    for (let row = 0; row < dots; row++) {
      for (let col = 0; col < dots; col++) {
        const dist = Math.hypot(local.x - (PAD + col * CELL), local.y - (PAD + row * CELL));
        if (dist < bestDist) {
          best = { row, col };
          bestDist = dist;
        }
      }
    }
    return best;
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
    if (!canDraw) return;
    const point = pointAt(event.clientX, event.clientY);
    if (drag.current?.moved && !point) return;
    if (!point) {
      setSelected(null);
      return;
    }
    if (selected && samePoint(selected, point)) {
      setSelected(null);
      return;
    }
    if (selected) {
      const edge = edgeBetween(selected, point);
      if (edge && !isDrawn(board, edge)) {
        onDraw(edge);
        setSelected(null);
        return;
      }
    }
    if (freeNeighbors(board, point).length > 0) setSelected(point);
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
        {board.owners.map((row, r) =>
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
        {board.horizontal.map((row, r) =>
          row.map((drawn, c) => (
            <line
              key={`h-${r}-${c}`}
              x1={PAD + c * CELL}
              y1={PAD + r * CELL}
              x2={PAD + (c + 1) * CELL}
              y2={PAD + r * CELL}
              stroke={drawn ? "#2b2118" : "#e6d7c2"}
              strokeWidth={drawn ? 6 : 2}
              strokeLinecap="round"
            />
          )),
        )}
        {board.vertical.map((row, r) =>
          row.map((drawn, c) => (
            <line
              key={`v-${r}-${c}`}
              x1={PAD + c * CELL}
              y1={PAD + r * CELL}
              x2={PAD + c * CELL}
              y2={PAD + (r + 1) * CELL}
              stroke={drawn ? "#2b2118" : "#e6d7c2"}
              strokeWidth={drawn ? 6 : 2}
              strokeLinecap="round"
            />
          )),
        )}
        {Array.from({ length: dots }, (_, row) =>
          Array.from({ length: dots }, (_, col) => {
            const isSel = selected ? samePoint(selected, { row, col }) : false;
            const isTarget = targets.some((p) => samePoint(p, { row, col }));
            const kind = isSel ? "selected" : isTarget ? "target" : "idle";
            return (
              <circle
                key={`d-${row}-${col}`}
                className={`board-dot board-dot-${kind}`}
                cx={PAD + col * CELL}
                cy={PAD + row * CELL}
                r={isSel || isTarget ? 9 : 6}
                aria-label={`ponto linha ${row + 1} coluna ${col + 1}`}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}

function samePoint(a: Point, b: Point) {
  return a.row === b.row && a.col === b.col;
}

function isDrawn(game: GameState, edge: Edge) {
  return edge.orientation === "h"
    ? game.horizontal[edge.row][edge.col]
    : game.vertical[edge.row][edge.col];
}

function edgeBetween(a: Point, b: Point): Edge | null {
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
    return { orientation: "h", row: a.row, col: Math.min(a.col, b.col) };
  }
  if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
    return { orientation: "v", row: Math.min(a.row, b.row), col: a.col };
  }
  return null;
}

function freeNeighbors(game: GameState, point: Point): Point[] {
  const last = game.size;
  const candidates: Point[] = [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ];
  return candidates.filter((next) => {
    if (next.row < 0 || next.col < 0 || next.row > last || next.col > last) return false;
    const edge = edgeBetween(point, next);
    return edge !== null && !isDrawn(game, edge);
  });
}
