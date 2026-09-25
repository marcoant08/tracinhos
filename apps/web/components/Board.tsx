"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { GameState } from "@tracinhos/game";
import { BOARD_GLOW_MS, COLOR_HEX, STROKE_GROW_MS, type ColorId, type PublicRoom } from "@tracinhos/shared";

const CELL = 56;
const PAD = 28;
const DOT_HIT = 22;
const PAPER_RX = 16;
type Edge = { orientation: "h" | "v"; row: number; col: number };
type Point = { row: number; col: number };

export function Board({
  room,
  canDraw,
  borderColor,
  flash,
  onDraw,
}: {
  room: PublicRoom;
  canDraw: boolean;
  borderColor?: string | null;
  flash?: string | null;
  onDraw: (edge: Edge) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const [frame, setFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );
  const moved = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const localFrom = useRef<Point | null>(null);
  const growFrom = useRef<Map<string, Point | null>>(new Map());
  const seenEdges = useRef<Set<string> | null>(null);
  const seenSquares = useRef<Set<string> | null>(null);
  const revealTimers = useRef<number[]>([]);
  const [growing, setGrowing] = useState<Set<string>>(() => new Set());
  const [hiddenSquares, setHiddenSquares] = useState<Set<string>>(() => new Set());

  const game = room.game;

  useEffect(() => {
    if (!canDraw) setSelected(null);
  }, [canDraw]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !borderColor) {
      setFrame(null);
      return;
    }
    const sync = () => {
      const a = wrap.getBoundingClientRect();
      const b = svg.getBoundingClientRect();
      setFrame({
        top: b.top - a.top,
        left: b.left - a.left,
        width: b.width,
        height: b.height,
      });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [borderColor, room.game?.cols, room.game?.rows]);

  useLayoutEffect(() => {
    const next = room.game;
    if (!next) return;
    const edgeKeys = drawnEdgeKeys(next);
    const squareKeys = ownedSquareKeys(next);
    if (seenEdges.current === null) {
      seenEdges.current = edgeKeys;
      seenSquares.current = squareKeys;
      return;
    }
    const newEdges = [...edgeKeys].filter((key) => !seenEdges.current!.has(key));
    const newSquares = [...squareKeys].filter((key) => !seenSquares.current!.has(key));
    seenEdges.current = edgeKeys;
    seenSquares.current = squareKeys;
    if (newEdges.length === 0 && newSquares.length === 0) return;

    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || newEdges.length === 0) return;

    const origin = localFrom.current;
    localFrom.current = null;
    for (const key of newEdges) growFrom.current.set(key, origin);

    setGrowing((prev) => {
      const nextSet = new Set(prev);
      for (const key of newEdges) nextSet.add(key);
      return nextSet;
    });
    if (newSquares.length) {
      setHiddenSquares((prev) => {
        const nextSet = new Set(prev);
        for (const key of newSquares) nextSet.add(key);
        return nextSet;
      });
    }
    const timer = window.setTimeout(() => {
      revealTimers.current = revealTimers.current.filter((id) => id !== timer);
      setGrowing((prev) => {
        const nextSet = new Set(prev);
        for (const key of newEdges) nextSet.delete(key);
        return nextSet;
      });
      setHiddenSquares((prev) => {
        const nextSet = new Set(prev);
        for (const key of newSquares) nextSet.delete(key);
        return nextSet;
      });
    }, STROKE_GROW_MS);
    revealTimers.current.push(timer);
  }, [room.game]);

  useEffect(() => {
    return () => {
      for (const id of revealTimers.current) window.clearTimeout(id);
      revealTimers.current = [];
    };
  }, []);

  if (!game) return null;
  const board: GameState = game;

  const colors = new Map(room.players.map((p) => [p.id, p.color]));
  const cols = board.cols;
  const rows = board.rows;
  const dotsX = cols + 1;
  const dotsY = rows + 1;
  const width = PAD * 2 + cols * CELL;
  const height = PAD * 2 + rows * CELL;
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
    for (let row = 0; row < dotsY; row++) {
      for (let col = 0; col < dotsX; col++) {
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
        localFrom.current = selected;
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
      data-glow={borderColor ? "on" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        origin.current = null;
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {flash ? (
          <g key={flash} className="board-glow" style={{ animationDuration: `${BOARD_GLOW_MS}ms` }}>
            <defs>
              <radialGradient id="turn-glow" cx="50%" cy="50%" r="68%">
                <stop offset="35%" stopColor={flash} stopOpacity="0" />
                <stop offset="100%" stopColor={flash} stopOpacity="0.55" />
              </radialGradient>
            </defs>
            <rect
              x="0"
              y="0"
              width={width}
              height={height}
              rx={PAPER_RX}
              fill="url(#turn-glow)"
              pointerEvents="none"
            />
          </g>
        ) : null}
        {board.owners.map((row, r) =>
          row.map((owner, c) => {
            if (!owner || hiddenSquares.has(`q-${r}-${c}`)) return null;
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
              from: growFrom.current.get(`h-${r}-${c}`) ?? null,
              growing: growing.has(`h-${r}-${c}`),
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
              from: growFrom.current.get(`v-${r}-${c}`) ?? null,
              growing: growing.has(`v-${r}-${c}`),
              label: `traço vertical linha ${r + 1} coluna ${c + 1}`,
            }),
          ),
        )}
        {Array.from({ length: dotsY }, (_, row) =>
          Array.from({ length: dotsX }, (_, col) => {
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
      {borderColor && frame ? (
        <span
          className="board-turn-border"
          style={{
            color: borderColor,
            top: frame.top + 2,
            left: frame.left + 2,
            width: frame.width - 4,
            height: frame.height - 4,
          }}
          aria-hidden="true"
        />
      ) : null}
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
  from,
  growing,
  label,
}: {
  key: string;
  owner: string | null;
  colors: Map<string, ColorId>;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  from: Point | null;
  growing: boolean;
  label: string;
}) {
  const drawn = owner !== null;
  const colorId = owner ? colors.get(owner) : undefined;
  const directed = growing ? growCoords(x1, y1, x2, y2, from) : { x1, y1, x2, y2 };
  const length = Math.hypot(directed.x2 - directed.x1, directed.y2 - directed.y1);
  const growStyle = growing
    ? ({
        ["--dash" as string]: length,
        ["--grow-ms" as string]: `${STROKE_GROW_MS}ms`,
        } as CSSProperties)
    : undefined;
  return (
    <g key={key} aria-label={label}>
      <line
        className={growing ? "edge-grow" : undefined}
        x1={directed.x1}
        y1={directed.y1}
        x2={directed.x2}
        y2={directed.y2}
        stroke={drawn ? "#2b2118" : "#e6d7c2"}
        strokeWidth={drawn ? 8 : 2}
        strokeLinecap="round"
        style={growStyle}
      />
      {drawn && colorId ? (
        <line
          className={growing ? "edge-grow" : undefined}
          x1={directed.x1}
          y1={directed.y1}
          x2={directed.x2}
          y2={directed.y2}
          stroke={COLOR_HEX[colorId]}
          strokeWidth={5}
          strokeLinecap="round"
          style={growStyle}
        />
      ) : null}
    </g>
  );
}

function growCoords(x1: number, y1: number, x2: number, y2: number, from: Point | null) {
  if (!from) return { x1, y1, x2, y2 };
  const fx = PAD + from.col * CELL;
  const fy = PAD + from.row * CELL;
  if (Math.hypot(fx - x2, fy - y2) < Math.hypot(fx - x1, fy - y1)) {
    return { x1: x2, y1: y2, x2: x1, y2: y1 };
  }
  return { x1, y1, x2, y2 };
}

function drawnEdgeKeys(game: GameState) {
  const keys = new Set<string>();
  game.horizontal.forEach((row, r) =>
    row.forEach((owner, c) => {
      if (owner) keys.add(`h-${r}-${c}`);
    }),
  );
  game.vertical.forEach((row, r) =>
    row.forEach((owner, c) => {
      if (owner) keys.add(`v-${r}-${c}`);
    }),
  );
  return keys;
}

function ownedSquareKeys(game: GameState) {
  const keys = new Set<string>();
  game.owners.forEach((row, r) =>
    row.forEach((owner, c) => {
      if (owner) keys.add(`q-${r}-${c}`);
    }),
  );
  return keys;
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
  const lastRow = game.rows;
  const lastCol = game.cols;
  const candidates: Point[] = [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ];
  return candidates.filter((next) => {
    if (next.row < 0 || next.col < 0 || next.row > lastRow || next.col > lastCol) return false;
    const edge = edgeBetween(point, next);
    return edge !== null && !isDrawn(game, edge);
  });
}
