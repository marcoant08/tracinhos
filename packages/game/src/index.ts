export const MIN_SIZE = 2;
export const MAX_SIZE = 10;
export const DEFAULT_SIZE = 5;
export const MAX_PLAYERS = 5;

export type Edge = {
  orientation: "h" | "v";
  row: number;
  col: number;
};

export type GameState = {
  size: number;
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

export function createGame(size: number, playerIds: string[]): GameState {
  if (size < MIN_SIZE || size > MAX_SIZE || !Number.isInteger(size)) {
    throw new Error("invalid_size");
  }
  if (playerIds.length < 2 || playerIds.length > MAX_PLAYERS) {
    throw new Error("invalid_players");
  }

  const n = size + 1;
  const scores: Record<string, number> = {};
  for (const id of playerIds) scores[id] = 0;

  return {
    size,
    horizontal: emptyEdges(n, size),
    vertical: emptyEdges(size, n),
    owners: emptyOwners(size),
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
  for (const sq of adjacentSquares(next.size, edge)) {
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

  const index = Math.min(
    legal.length - 1,
    Math.max(0, Math.floor(random() * legal.length)),
  );
  return legal[index];
}

export function listLegalEdges(state: GameState): Edge[] {
  const edges: Edge[] = [];
  const n = state.size + 1;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < state.size; col++) {
      const edge: Edge = { orientation: "h", row, col };
      if (isLegalEdge(state, edge)) edges.push(edge);
    }
  }
  for (let row = 0; row < state.size; row++) {
    for (let col = 0; col < n; col++) {
      const edge: Edge = { orientation: "v", row, col };
      if (isLegalEdge(state, edge)) edges.push(edge);
    }
  }
  return edges;
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

function emptyOwners(size: number): (string | null)[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
}

function cloneState(state: GameState): GameState {
  return {
    size: state.size,
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
  const n = state.size + 1;
  if (edge.orientation === "h") {
    return edge.row >= 0 && edge.row < n && edge.col >= 0 && edge.col < state.size;
  }
  return edge.row >= 0 && edge.row < state.size && edge.col >= 0 && edge.col < n;
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
  size: number,
  edge: Edge,
): { row: number; col: number }[] {
  const squares: { row: number; col: number }[] = [];
  if (edge.orientation === "h") {
    if (edge.row < size) squares.push({ row: edge.row, col: edge.col });
    if (edge.row > 0) squares.push({ row: edge.row - 1, col: edge.col });
  } else {
    if (edge.col < size) squares.push({ row: edge.row, col: edge.col });
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

function wouldCompleteAny(state: GameState, edge: Edge): boolean {
  const next = cloneState(state);
  setDrawn(next, edge, "_");
  return adjacentSquares(next.size, edge).some(
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
