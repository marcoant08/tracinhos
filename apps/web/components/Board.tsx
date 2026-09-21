"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { GameState } from "@tracinhos/game";
import { COLOR_HEX, type ColorId, type PublicRoom } from "@tracinhos/shared";

const CELL = 56;
const PAD = 28;
const DOT_HIT = 22;

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
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const moved = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

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
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
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
    moved.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!origin.current) return;
    if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) {
      moved.current = true;
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const wasMoved = moved.current;
    origin.current = null;
    if (wasMoved) return;
    if (!canDraw) return;
    const point = pointAt(event.clientX, event.clientY);
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
      className="board-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        origin.current = null;
      }}
    >
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
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
          row.map((owner, c) =>
            edgeMarks({
              key: `h-${r}-${c}`,
              owner,
              colors,
              x1: PAD + c * CELL,
              y1: PAD + r * CELL,
              x2: PAD + (c + 1) * CELL,
              y2: PAD + r * CELL,
              label: `traço horizontal linha ${r + 1} coluna ${c + 1}`,
            }),
          ),
        )}
        {board.vertical.map((row, r) =>
          row.map((owner, c) =>
            edgeMarks({
              key: `v-${r}-${c}`,
              owner,
              colors,
              x1: PAD + c * CELL,
              y1: PAD + r * CELL,
              x2: PAD + c * CELL,
              y2: PAD + (r + 1) * CELL,
              label: `traço vertical linha ${r + 1} coluna ${c + 1}`,
            }),
          ),
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
                r={isSel || isTarget ? 10 : 7}
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
    ? game.horizontal[edge.row][edge.col] !== null
    : game.vertical[edge.row][edge.col] !== null;
}

function edgeMarks({
  key,
  owner,
  colors,
  x1,
  y1,
  x2,
  y2,
  label,
}: {
  key: string;
  owner: string | null;
  colors: Map<string, ColorId>;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}) {
  const drawn = owner !== null;
  const colorId = owner ? colors.get(owner) : undefined;
  return (
    <g key={key} aria-label={label}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={drawn ? "#2b2118" : "#e6d7c2"}
        strokeWidth={drawn ? 6 : 2}
        strokeLinecap="round"
      />
      {drawn && colorId ? (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={COLOR_HEX[colorId]}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
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
