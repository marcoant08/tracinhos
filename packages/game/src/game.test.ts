import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  isLegalEdge,
  listLegalEdges,
  pickBotMove,
  pickRandomMove,
  scoreSumEqualsOwned,
  countEdgesByPlayer,
  TALL_GRID,
  type Edge,
  type GameState,
} from "./index.js";

function play(state: GameState, playerId: string, edge: Edge): GameState {
  return applyMove(state, playerId, edge).state;
}

describe("createGame", () => {
  it("aceita S=2 e S=10", () => {
    const small = createGame(2, ["a", "b"]);
    expect(small.horizontal).toHaveLength(3);
    expect(small.horizontal[0]).toHaveLength(2);
    expect(small.vertical).toHaveLength(2);
    expect(small.vertical[0]).toHaveLength(3);
    expect(small.owners).toHaveLength(2);

    const big = createGame(10, ["a", "b"]);
    expect(big.cols).toBe(10);
    expect(big.rows).toBe(10);
    expect(big.owners).toHaveLength(10);
    expect(big.owners[0]).toHaveLength(10);
    expect(listLegalEdges(big)).toHaveLength(2 * 10 * 11);
  });

  it("aceita 10×15 pontos (9×14 quadrados)", () => {
    const tall = createGame(TALL_GRID.cols, ["a", "b"], TALL_GRID.rows);
    expect(tall.cols).toBe(9);
    expect(tall.rows).toBe(14);
    expect(tall.horizontal).toHaveLength(15);
    expect(tall.horizontal[0]).toHaveLength(9);
    expect(tall.vertical).toHaveLength(14);
    expect(tall.vertical[0]).toHaveLength(10);
    expect(tall.owners).toHaveLength(14);
    expect(tall.owners[0]).toHaveLength(9);
    expect(listLegalEdges(tall)).toHaveLength(15 * 9 + 14 * 10);
  });
});

describe("grade retangular", () => {
  it("fecha um quadrado na última linha de 2×3", () => {
    let state = createGame(2, ["a", "b"], 3);
    state = play(state, "a", { orientation: "h", row: 2, col: 0 });
    state = play(state, "b", { orientation: "h", row: 3, col: 0 });
    state = play(state, "a", { orientation: "v", row: 2, col: 0 });
    const result = applyMove(state, "b", { orientation: "v", row: 2, col: 1 });
    expect(result.completedSquares).toEqual([{ row: 2, col: 0 }]);
    expect(result.state.owners[2][0]).toBe("b");
    expect(result.state.currentPlayerIndex).toBe(1);
  });
});

describe("applyMove", () => {
  it("recusa jogada fora da vez e aresta ilegal", () => {
    const state = createGame(2, ["a", "b"]);
    expect(() =>
      applyMove(state, "b", { orientation: "h", row: 0, col: 0 }),
    ).toThrow(/not_your_turn/);
    expect(() =>
      applyMove(state, "a", { orientation: "h", row: 99, col: 0 }),
    ).toThrow(/illegal_move/);

    const after = play(state, "a", { orientation: "h", row: 0, col: 0 });
    expect(after.horizontal[0][0]).toBe("a");
    expect(countEdgesByPlayer(after)).toEqual({ a: 1, b: 0 });
    expect(() =>
      applyMove(after, "b", { orientation: "h", row: 0, col: 0 }),
    ).toThrow(/illegal_move/);
    expect(isLegalEdge(after, { orientation: "h", row: 0, col: 0 })).toBe(false);
  });

  it("fecha 1 quadrado, pontua e dá jogada extra", () => {
    let state = createGame(2, ["a", "b"]);
    state = play(state, "a", { orientation: "h", row: 0, col: 0 });
    state = play(state, "b", { orientation: "h", row: 1, col: 0 });
    state = play(state, "a", { orientation: "v", row: 0, col: 0 });
    expect(state.currentPlayerIndex).toBe(1);

    const result = applyMove(state, "b", { orientation: "v", row: 0, col: 1 });
    expect(result.completedSquares).toEqual([{ row: 0, col: 0 }]);
    expect(result.state.owners[0][0]).toBe("b");
    expect(result.state.scores.b).toBe(1);
    expect(result.state.currentPlayerIndex).toBe(1);
    expect(scoreSumEqualsOwned(result.state)).toBe(true);
  });

  it("fecha 2 quadrados no mesmo traço, soma 2 e dá uma extra", () => {
    let state = createGame(2, ["a", "b"]);
    const setup: [string, Edge][] = [
      ["a", { orientation: "h", row: 0, col: 0 }],
      ["b", { orientation: "h", row: 0, col: 1 }],
      ["a", { orientation: "v", row: 0, col: 0 }],
      ["b", { orientation: "v", row: 0, col: 2 }],
      ["a", { orientation: "h", row: 1, col: 0 }],
      ["b", { orientation: "h", row: 1, col: 1 }],
      ["a", { orientation: "v", row: 1, col: 0 }],
      ["b", { orientation: "v", row: 1, col: 2 }],
      ["a", { orientation: "h", row: 2, col: 0 }],
      ["b", { orientation: "h", row: 2, col: 1 }],
    ];
    for (const [id, edge] of setup) {
      state = play(state, id, edge);
    }
    expect(state.owners[0][0]).toBeNull();
    expect(state.currentPlayerIndex).toBe(0);

    const result = applyMove(state, "a", { orientation: "v", row: 0, col: 1 });
    expect(result.completedSquares).toHaveLength(2);
    expect(result.state.scores.a).toBe(2);
    expect(result.state.currentPlayerIndex).toBe(0);
    expect(scoreSumEqualsOwned(result.state)).toBe(true);
  });

  it("sem fechar, avança o turno entre 3 jogadores", () => {
    let state = createGame(2, ["a", "b", "c"]);
    state = play(state, "a", { orientation: "h", row: 0, col: 0 });
    expect(state.currentPlayerIndex).toBe(1);
    state = play(state, "b", { orientation: "h", row: 0, col: 1 });
    expect(state.currentPlayerIndex).toBe(2);
    state = play(state, "c", { orientation: "h", row: 2, col: 0 });
    expect(state.currentPlayerIndex).toBe(0);
  });

  it("termina com vencedor único", () => {
    let state = createGame(2, ["a", "b"]);
    const edges = listLegalEdges(state);
    let guard = 0;
    while (state.status === "playing" && guard++ < 80) {
      const player = state.playerIds[state.currentPlayerIndex];
      const move = pickBotMove(state);
      state = play(state, player, move);
    }
    expect(state.status).toBe("finished");
    expect(listLegalEdges(state)).toHaveLength(0);
    expect(state.winnerIds.length).toBeGreaterThanOrEqual(1);
    expect(scoreSumEqualsOwned(state)).toBe(true);
    const owned = state.owners.flat().filter(Boolean).length;
    expect(owned).toBe(4);
  });

  it("empate quando as pontuações máximas coincidem", () => {
    let state = createGame(2, ["a", "b"]);
    const script: Edge[] = [
      { orientation: "v", row: 0, col: 0 },
      { orientation: "v", row: 0, col: 1 },
      { orientation: "h", row: 1, col: 0 },
      { orientation: "v", row: 1, col: 2 },
      { orientation: "h", row: 0, col: 0 },
      { orientation: "h", row: 0, col: 1 },
      { orientation: "h", row: 1, col: 1 },
      { orientation: "v", row: 0, col: 2 },
      { orientation: "v", row: 1, col: 0 },
      { orientation: "h", row: 2, col: 0 },
      { orientation: "h", row: 2, col: 1 },
      { orientation: "v", row: 1, col: 1 },
    ];
    for (const edge of script) {
      const player = state.playerIds[state.currentPlayerIndex];
      state = play(state, player, edge);
    }
    expect(state.status).toBe("finished");
    expect(state.scores.a).toBe(2);
    expect(state.scores.b).toBe(2);
    expect(state.winnerIds).toEqual(["a", "b"]);
    expect(scoreSumEqualsOwned(state)).toBe(true);
    const edges = countEdgesByPlayer(state);
    expect(edges.a + edges.b).toBe(12);
  });
});

describe("pickRandomMove", () => {
  it("escolhe uma aresta legal e o timeout avança a vez", () => {
    const state = createGame(2, ["a", "b"]);
    const edge = pickRandomMove(state);
    expect(edge).toEqual({ orientation: "h", row: 0, col: 0 });
    const after = play(state, "a", edge);
    expect(after.horizontal[0][0]).toBe("a");
    expect(after.currentPlayerIndex).toBe(1);
  });
});

describe("pickBotMove", () => {
  it("fecha um quadrado se puder", () => {
    let state = createGame(2, ["a", "b"]);
    state = play(state, "a", { orientation: "h", row: 0, col: 0 });
    state = play(state, "b", { orientation: "h", row: 1, col: 0 });
    state = play(state, "a", { orientation: "v", row: 0, col: 0 });
    const move = pickBotMove(state);
    expect(move).toEqual({ orientation: "v", row: 0, col: 1 });
  });

  it("evita deixar um quadrado com 3 lados quando há lance seguro", () => {
    let state = createGame(2, ["a", "b"]);
    state = play(state, "a", { orientation: "h", row: 1, col: 0 });
    state = play(state, "b", { orientation: "v", row: 0, col: 0 });
    const move = pickBotMove(state);
    expect(move).toEqual({ orientation: "h", row: 0, col: 1 });
  });

  it("se for obrigado a abrir, escolhe o lance que deixa menos quadrados", () => {
    const state = createGame(2, ["a", "b"]);
    for (const row of state.horizontal) {
      for (let col = 0; col < row.length; col++) row[col] = "x";
    }
    const move = pickBotMove(state, () => 0.25);
    expect(move).toEqual({ orientation: "v", row: 0, col: 2 });
  });
});
