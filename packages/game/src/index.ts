export const MIN_SIZE = 2;
export const MAX_SIZE = 14;
export const DEFAULT_SIZE = 5;
export const MAX_PLAYERS = 5;
/** 10 pontos de largura × 15 pontos de altura. */
export const TALL_GRID = { cols: 9, rows: 14 } as const;

export type Edge = {
  orientation: "h" | "v";
  row: number;
  col: number;
};

export type GameState = {
  cols: number;
  rows: number;
  horizontal: (string | null)[][];
  vertical: (string | null)[][];
  owners: (string | null)[][];
  playerIds: string[];
  currentPlayerIndex: number;
  scores: Record<string, number>;
  status: "playing" | "finished";
  winnerIds: string[];
};

export class GameError extends Error {
  readonly code: "not_your_turn" | "illegal_move";

  constructor(code: "not_your_turn" | "illegal_move") {
    super(code);
    this.name = "GameError";
    this.code = code;
  }
}

export function isValidGrid(cols: number, rows: number): boolean {
  return (
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols >= MIN_SIZE &&
    rows >= MIN_SIZE &&
    cols <= MAX_SIZE &&
    rows <= MAX_SIZE
  );
}

export function parseGrid(cols: number, rows: number): { cols: number; rows: number } {
  if (!isValidGrid(cols, rows)) throw new Error("invalid_size");
  return { cols, rows };
}

export function createGame(cols: number, playerIds: string[], rows = cols): GameState {
  const grid = parseGrid(cols, rows);
  if (playerIds.length < 2 || playerIds.length > MAX_PLAYERS) {
    throw new Error("invalid_players");
  }

  const scores: Record<string, number> = {};
  for (const id of playerIds) scores[id] = 0;

  return {
    cols: grid.cols,
    rows: grid.rows,
    horizontal: emptyEdges(grid.rows + 1, grid.cols),
    vertical: emptyEdges(grid.rows, grid.cols + 1),
    owners: emptyOwners(grid.rows, grid.cols),
    playerIds: [...playerIds],
    currentPlayerIndex: 0,
    scores,
    status: "playing",
    winnerIds: [],
  };
}

export function isLegalEdge(state: GameState, edge: Edge): boolean {
  if (state.status !== "playing") return false;
  if (!inBounds(state, edge)) return false;
  return !isDrawn(state, edge);
}

export function applyMove(
  state: GameState,
  playerId: string,
  edge: Edge,
): { state: GameState; completedSquares: { row: number; col: number }[] } {
  if (state.playerIds[state.currentPlayerIndex] !== playerId) {
    throw new GameError("not_your_turn");
  }
  if (!isLegalEdge(state, edge)) {
    throw new GameError("illegal_move");
  }

  const next = cloneState(state);
  setDrawn(next, edge, playerId);

  const completedSquares: { row: number; col: number }[] = [];
  for (const sq of adjacentSquares(next, edge)) {
    if (next.owners[sq.row][sq.col] === null && squareComplete(next, sq.row, sq.col)) {
      next.owners[sq.row][sq.col] = playerId;
      next.scores[playerId] += 1;
      completedSquares.push(sq);
    }
  }

  if (completedSquares.length === 0) {
    next.currentPlayerIndex =
      (next.currentPlayerIndex + 1) % next.playerIds.length;
  }

  if (remainingEdges(next) === 0) {
    next.status = "finished";
    next.winnerIds = winnersOf(next);
  }

  return { state: next, completedSquares };
}

export function pickRandomMove(
  state: GameState,
  random: () => number = () => 0,
): Edge {
  const legal = listLegalEdges(state);
  if (legal.length === 0) {
    throw new GameError("illegal_move");
  }
  const index = Math.min(
    legal.length - 1,
    Math.max(0, Math.floor(random() * legal.length)),
  );
  return legal[index];
}

export function pickBotMove(
  state: GameState,
  random: () => number = () => 0,
): Edge {
  const legal = listLegalEdges(state);
  if (legal.length === 0) {
    throw new GameError("illegal_move");
  }

  const completing = legal.filter((edge) => wouldCompleteAny(state, edge));
  if (completing.length > 0) {
    return completing[0];
  }

  let bestGifts = Infinity;
  const safest: Edge[] = [];
  for (const edge of legal) {
    const gifts = countOpenThreesAfter(state, edge);
    if (gifts < bestGifts) {
      bestGifts = gifts;
      safest.length = 0;
      safest.push(edge);
    } else if (gifts === bestGifts) {
      safest.push(edge);
    }
  }
  const index = Math.min(
    safest.length - 1,
    Math.max(0, Math.floor(random() * safest.length)),
  );
  return safest[index];
}

export function listLegalEdges(state: GameState): Edge[] {
  const edges: Edge[] = [];
  for (let row = 0; row < state.rows + 1; row++) {
    for (let col = 0; col < state.cols; col++) {
      const edge: Edge = { orientation: "h", row, col };
      if (isLegalEdge(state, edge)) edges.push(edge);
    }
  }
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols + 1; col++) {
      const edge: Edge = { orientation: "v", row, col };
      if (isLegalEdge(state, edge)) edges.push(edge);
    }
  }
  return edges;
}

export function countEdgesByPlayer(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of state.playerIds) counts[id] = 0;
  for (const row of state.horizontal) {
    for (const owner of row) {
      if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
    }
  }
  for (const row of state.vertical) {
    for (const owner of row) {
      if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
    }
  }
  return counts;
}

export function scoreSumEqualsOwned(state: GameState): boolean {
  let owned = 0;
  for (const row of state.owners) {
    for (const owner of row) if (owner) owned += 1;
  }
  const sum = Object.values(state.scores).reduce((a, b) => a + b, 0);
  return sum === owned;
}

function emptyEdges(rows: number, cols: number): (string | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

function emptyOwners(rows: number, cols: number): (string | null)[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
}

function cloneState(state: GameState): GameState {
  return {
    cols: state.cols,
    rows: state.rows,
    horizontal: state.horizontal.map((row) => [...row]),
    vertical: state.vertical.map((row) => [...row]),
    owners: state.owners.map((row) => [...row]),
    playerIds: [...state.playerIds],
    currentPlayerIndex: state.currentPlayerIndex,
    scores: { ...state.scores },
    status: state.status,
    winnerIds: [...state.winnerIds],
  };
}

function inBounds(state: GameState, edge: Edge): boolean {
  if (edge.orientation === "h") {
    return (
      edge.row >= 0 &&
      edge.row < state.rows + 1 &&
      edge.col >= 0 &&
      edge.col < state.cols
    );
  }
  return (
    edge.row >= 0 &&
    edge.row < state.rows &&
    edge.col >= 0 &&
    edge.col < state.cols + 1
  );
}

function isDrawn(state: GameState, edge: Edge): boolean {
  return edgeOwner(state, edge) !== null;
}

function edgeOwner(state: GameState, edge: Edge): string | null {
  return edge.orientation === "h"
    ? state.horizontal[edge.row][edge.col]
    : state.vertical[edge.row][edge.col];
}

function setDrawn(state: GameState, edge: Edge, playerId: string): void {
  if (edge.orientation === "h") state.horizontal[edge.row][edge.col] = playerId;
  else state.vertical[edge.row][edge.col] = playerId;
}

function adjacentSquares(
  state: GameState,
  edge: Edge,
): { row: number; col: number }[] {
  const squares: { row: number; col: number }[] = [];
  if (edge.orientation === "h") {
    if (edge.row < state.rows) squares.push({ row: edge.row, col: edge.col });
    if (edge.row > 0) squares.push({ row: edge.row - 1, col: edge.col });
  } else {
    if (edge.col < state.cols) squares.push({ row: edge.row, col: edge.col });
    if (edge.col > 0) squares.push({ row: edge.row, col: edge.col - 1 });
  }
  return squares;
}

function squareComplete(state: GameState, row: number, col: number): boolean {
  return (
    state.horizontal[row][col] !== null &&
    state.horizontal[row + 1][col] !== null &&
    state.vertical[row][col] !== null &&
    state.vertical[row][col + 1] !== null
  );
}

function sideCount(state: GameState, row: number, col: number): number {
  return (
    (state.horizontal[row][col] !== null ? 1 : 0) +
    (state.horizontal[row + 1][col] !== null ? 1 : 0) +
    (state.vertical[row][col] !== null ? 1 : 0) +
    (state.vertical[row][col + 1] !== null ? 1 : 0)
  );
}

function countOpenThrees(state: GameState): number {
  let n = 0;
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      if (state.owners[row][col] !== null) continue;
      if (sideCount(state, row, col) === 3) n += 1;
    }
  }
  return n;
}

function countOpenThreesAfter(state: GameState, edge: Edge): number {
  const next = cloneState(state);
  setDrawn(next, edge, "_");
  return countOpenThrees(next);
}

function wouldCompleteAny(state: GameState, edge: Edge): boolean {
  const next = cloneState(state);
  setDrawn(next, edge, "_");
  return adjacentSquares(next, edge).some(
    (sq) => next.owners[sq.row][sq.col] === null && squareComplete(next, sq.row, sq.col),
  );
}

function remainingEdges(state: GameState): number {
  let open = 0;
  for (const row of state.horizontal) for (const cell of row) if (cell === null) open += 1;
  for (const row of state.vertical) for (const cell of row) if (cell === null) open += 1;
  return open;
}

function winnersOf(state: GameState): string[] {
  const max = Math.max(...Object.values(state.scores));
  return state.playerIds.filter((id) => state.scores[id] === max);
}
