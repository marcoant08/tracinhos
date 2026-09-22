"use client";

import { useEffect, useRef, useState } from "react";
import { applyMove, countEdgesByPlayer, MAX_PLAYERS, type Edge, type GameState } from "@tracinhos/game";
import {
  BOT_THINK_MS,
  BOARD_GLOW_MS,
  COLOR_HEX,
  ERROR_MESSAGES,
  LOBBY_POLL_MS,
  RESULT_HOLD_MS,
  TURN_TIMEOUT_MS,
  type ColorId,
  type PublicRoom,
  type Session,
} from "@tracinhos/shared";
import { Board } from "./Board";
import { ColorPicker } from "./ColorPicker";
import { ScoreSquare, ScoreStroke } from "./Marks";
import { Toast } from "./Toast";
import { clearSession, loadIdentity, loadSession, saveIdentity, saveSession } from "@/lib/session";

export function RoomApp({ code }: { code: string }) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [nick, setNick] = useState("");
  const [color, setColor] = useState<ColorId>("blue");
  const [toast, setToast] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [wsDown, setWsDown] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<object[]>([]);
  const backoff = useRef(1000);
  const toastMs = useRef(2200);
  const playerIdRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const [holdingBoard, setHoldingBoard] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingEdges, setPendingEdges] = useState<Edge[]>([]);
  const roomRef = useRef(room);
  playerIdRef.current = session?.playerId ?? null;
  roomRef.current = room;

  function flush(ws: WebSocket) {
    while (queueRef.current.length && ws.readyState === WebSocket.OPEN) {
      const payload = queueRef.current.shift();
      if (payload) ws.send(JSON.stringify(payload));
    }
  }

  async function refreshRoom() {
    try {
      const token = loadSession(roomCode)?.seatToken;
      const res = await fetch(`/api/rooms/${roomCode}`, {
        cache: "no-store",
        headers: token ? { "x-seat-token": token } : {},
      });
      if (res.status === 404) {
        setRoom(null);
        return null;
      }
      if (res.ok) {
        const next = (await res.json()) as PublicRoom;
        setRoom((prev) => preferRoom(prev, next));
        return next;
      }
    } catch {
      /* rede */
    }
    return undefined;
  }

  function send(payload: object) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    queueRef.current.push(payload);
  }

  async function submitDraw(edge: Edge) {
    const token = loadSession(roomCode)?.seatToken;
    if (!token) {
      send({ type: "game:draw", edge });
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${roomCode}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatToken: token, edge }),
      });
      const data = (await res.json()) as { room?: PublicRoom; message?: string; error?: string };
      const nextRoom = data.room;
      if (!res.ok || !nextRoom) {
        setPendingEdges((prev) => (prev.length ? prev.slice(0, -1) : prev));
        setToast(data.message ?? ERROR_MESSAGES[(data.error as keyof typeof ERROR_MESSAGES) ?? "illegal_move"]);
        return;
      }
      setRoom((prev) => preferRoom(prev, nextRoom));
    } catch {
      send({ type: "game:draw", edge });
    }
  }

  useEffect(() => {
    setSession(loadSession(roomCode));
    const pref = loadIdentity();
    if (pref) {
      setNick(pref.nick);
      setColor(pref.color);
    }
    void refreshRoom();
  }, [roomCode]);

  useEffect(() => {
    if (elsewhere || room === null) return;
    if (room && room.status !== "lobby" && room.status !== "playing") return;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void refreshRoom();
    };
    const id = setInterval(tick, LOBBY_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [elsewhere, roomCode, room === null, room?.status]);

  useEffect(() => {
    if (!session || elsewhere) return;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      function applyServerMessage(message: {
        type?: string;
        session?: Session;
        room?: PublicRoom;
        notice?: string;
        playerId?: string;
        nick?: string;
        error?: string;
        message?: string;
      }) {
        if (message.type === "session" && message.session) {
          saveSession(message.session);
          setSession(message.session);
        }
        if ((message.type === "game:state" || message.type === "game:over") && message.room) {
          setRoom((prev) => preferRoom(prev, message.room!));
        }
        if (message.type === "game:notice" && message.notice === "timeout_draw") {
          toastMs.current = 3500;
          const mine = message.playerId === playerIdRef.current;
          setToast(
            mine
              ? "Seu tempo acabou. Um traço aleatório foi marcado no seu nome."
              : `O tempo de ${message.nick} acabou. Um traço aleatório foi marcado no nome de ${message.nick}.`,
          );
        }
        if (message.type === "room:error") {
          if (message.error === "illegal_move" || message.error === "not_your_turn") {
            setPendingEdges((prev) => (prev.length ? prev.slice(0, -1) : prev));
          }
          if (message.error === "invalid_token" || message.error === "room_not_found") {
            clearSession(roomCode);
            setSession(null);
          }
          toastMs.current = 2200;
          setToast(message.message ?? ERROR_MESSAGES[message.error as keyof typeof ERROR_MESSAGES]);
        }
        if (message.type === "resumed_elsewhere") {
          setElsewhere(true);
          ws.close();
        }
      }
      ws.onopen = () => {
        backoff.current = 1000;
        setWsDown(false);
        ws.send(
          JSON.stringify({
            type: "room:resume",
            roomCode: session.roomCode,
            seatToken: session.seatToken,
          }),
        );
        flush(ws);
        void refreshRoom();
      };
      ws.onmessage = (event) => {
        const raw = event.data;
        const text =
          typeof raw === "string"
            ? raw
            : raw instanceof ArrayBuffer
              ? new TextDecoder().decode(raw)
              : raw instanceof Blob
                ? null
                : String(raw);
        if (text === null) {
          void (raw as Blob).text().then((blobText) => applyServerMessage(JSON.parse(blobText)));
          return;
        }
        try {
          applyServerMessage(JSON.parse(text));
        } catch {
          /* frame inválido */
        }
      };
      ws.onclose = () => {
        if (stopped || elsewhere) return;
        setWsDown(true);
        const wait = backoff.current;
        backoff.current = Math.min(wait * 2, 30000);
        setTimeout(connect, wait);
      };
    };

    connect();
    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [session?.seatToken, roomCode, elsewhere]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toastMs.current);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!room) return;
    if (room.status === "playing") {
      wasPlayingRef.current = true;
      setHoldingBoard(false);
      return;
    }
    if (room.status !== "finished" || !wasPlayingRef.current) {
      setHoldingBoard(false);
      return;
    }
    setHoldingBoard(true);
    const t = setTimeout(() => setHoldingBoard(false), RESULT_HOLD_MS);
    return () => clearTimeout(t);
  }, [room?.status]);

  useEffect(() => {
    if (room?.status !== "playing" && !holdingBoard) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [room?.status, holdingBoard]);

  useEffect(() => {
    const game = room?.game;
    if (!game || room?.status !== "playing") {
      setPendingEdges((prev) => (prev.length ? [] : prev));
      return;
    }
    setPendingEdges((prev) => {
      const next = prev.filter((edge) => !edgeTaken(game, edge));
      return next.length === prev.length ? prev : next;
    });
  }, [room]);

  const turnPlayer = room?.status === "playing"
    ? room.players.find((p) => p.id === room.game?.playerIds[room.game.currentPlayerIndex])
    : undefined;
  const glowSignal = boardGlow({
    status: room?.status ?? "lobby",
    myTurn: Boolean(
      room &&
        session &&
        room.status === "playing" &&
        room.game?.playerIds[room.game.currentPlayerIndex] === session.playerId,
    ),
    currentKind: turnPlayer?.kind,
    deadlineAt: room?.turnDeadlineAt ?? null,
    now,
  });
  const borderColor =
    glowSignal === "red"
      ? COLOR_HEX.red
      : glowSignal === "orange"
        ? COLOR_HEX.orange
        : glowSignal === "turn" && turnPlayer
          ? COLOR_HEX[turnPlayer.color]
          : null;
  const flash = useGlowFlash(borderColor);

  async function sit() {
    const res = await fetch(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, color }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    saveSession(data.session);
    saveIdentity({ nick: data.session.nick, color: data.session.color });
    setSession(data.session);
    setRoom(data.room);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/sala/${roomCode}`);
      setToast("Link copiado");
    } catch {
      setToast("Não deu para copiar.");
    }
  }

  if (room === undefined) {
    return (
      <main className="page">
        <p>Carregando sala…</p>
        <Toast message={toast} />
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="page">
        <section className="stage">
          <h2>Sala não encontrada</h2>
          <a className="btn" href="/">
            Voltar ao lobby
          </a>
        </section>
        <Toast message={toast} />
      </main>
    );
  }

  if (elsewhere) {
    return (
      <main className="page">
        <section className="stage">
          <h2>Você abriu o jogo noutra aba.</h2>
        </section>
        <Toast message={toast} />
      </main>
    );
  }

  const wsFlag = <WsFlag show={wsDown} />;

  if (!session) {
    return (
      <main className="page">
        <div className="brand">
          <p className="code">{room.code}</p>
          <p>Já na sala: {room.players.map((p) => p.nick).join(", ") || "ninguém ainda"}</p>
        </div>
        <section className="stage">
          <h2>Entrar</h2>
          <div className="field">
            <label htmlFor="nick">Seu nick</label>
            <input id="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
          </div>
          <div className="field">
            <label>Sua cor</label>
            <ColorPicker value={color} taken={room.takenColors} onChange={setColor} />
          </div>
          <button className="btn" disabled={room.takenColors.includes(color)} onClick={() => void sit()}>
            Entrar
          </button>
        </section>
        <p>
          <a className="text-link" href="/regras">
            Regras do jogo
          </a>
        </p>
        <Toast message={toast} />
      </main>
    );
  }

  const isHost = session.playerId === room.hostPlayerId;
  const starterPlayer =
    room.starterPlayerId ? room.players.find((p) => p.id === room.starterPlayerId) : undefined;
  const starterValue = starterPlayer?.id ?? "";
  const viewRoom = withPendingMoves(room, session.playerId, pendingEdges);
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  const serverMyTurn = room.status === "playing" && currentId === session.playerId;
  const localMyTurn =
    viewRoom.game?.status === "playing" &&
    viewRoom.game.playerIds[viewRoom.game.currentPlayerIndex] === session.playerId;
  const myTurn = serverMyTurn || localMyTurn;
  const canDraw = localMyTurn || (serverMyTurn && pendingEdges.length === 0);
  const showBoard = room.status === "playing" || (room.status === "finished" && holdingBoard);
  const timerMs = current?.kind === "bot" ? BOT_THINK_MS : TURN_TIMEOUT_MS;

  if (room.status === "finished" && !holdingBoard) {
    return (
      <main className="page">
        <Results room={room} />
        <Toast message={toast} />
        {wsFlag}
      </main>
    );
  }

  if (showBoard) {
    return (
      <main className="page page-play">
        <div className="hud">
          <div className="hud-top">
            <div className={`turn ${myTurn ? "you" : ""}`}>
              <span
                className="dot"
                style={{ background: current ? COLOR_HEX[current.color] : "#888" }}
              />
              {myTurn ? (
                <span>
                  Sua vez
                  <small className="hint">Toque dois pontos vizinhos</small>
                </span>
              ) : (
                <span>
                  Vez de {current?.nick ?? "…"}
                  {current?.kind === "bot" ? <small className="hint">pensando…</small> : null}
                </span>
              )}
            </div>
            <div className="timer-slot">
              {room.turnDeadlineAt ? (
                <TurnTimer deadlineAt={room.turnDeadlineAt} durationMs={timerMs} />
              ) : null}
            </div>
          </div>
          <ScoreList room={viewRoom} currentId={currentId} />
        </div>
        <Board
          room={viewRoom}
          canDraw={canDraw}
          borderColor={borderColor}
          flash={flash}
          onDraw={(edge) => {
            setPendingEdges((prev) => [...prev, edge]);
            void submitDraw(edge);
          }}
        />
        <Toast message={toast} />
        {wsFlag}
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">
        <p className="code">{room.code}</p>
        <button className="btn ghost" onClick={() => void copyLink()}>
          Copiar link
        </button>
        <a className="text-link" href="/regras">
          Regras
        </a>
      </div>

      <section className="stage">
        <ul className="list">
          {room.players.map((p) => (
            <li key={p.id} style={nickTile(p.color)}>
              {p.nick}
              {p.id === room.hostPlayerId ? " · host" : ""}
              {p.kind === "bot" ? " · bot" : ""}
            </li>
          ))}
        </ul>
        <div className="field">
          <label htmlFor={isHost ? "starter" : undefined}>Quem começa</label>
          {isHost ? (
            <select
              id="starter"
              value={starterValue}
              onChange={(e) => {
                const playerId = e.target.value || null;
                setRoom((prev) =>
                  prev ? { ...prev, starterPlayerId: playerId, updatedAt: Date.now() } : prev,
                );
                send({ type: "room:setStarter", playerId });
              }}
            >
              <option value="">Aleatório</option>
              {room.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nick}
                </option>
              ))}
            </select>
          ) : (
            <p className="starter-read">
              {starterPlayer ? (
                <>
                  <span className="dot" style={{ background: COLOR_HEX[starterPlayer.color] }} />
                  {starterPlayer.nick}
                </>
              ) : (
                "Aleatório"
              )}
            </p>
          )}
        </div>
        {isHost ? (
          <>
            <button
              className="btn ghost"
              style={{ marginBottom: 10 }}
              disabled={room.players.length >= MAX_PLAYERS}
              onClick={() => send({ type: "room:addBot" })}
            >
              Adicionar bot
            </button>
            <button
              className="btn"
              disabled={room.players.length < 2}
              onClick={() => send({ type: "room:start" })}
            >
              Começar
            </button>
          </>
        ) : (
          <p className="waiting">Esperando o host…</p>
        )}
      </section>
      <Toast message={toast} />
      {wsFlag}
    </main>
  );
}

function ScoreList({ room, currentId }: { room: PublicRoom; currentId?: string }) {
  const strokes = room.game ? countEdgesByPlayer(room.game) : {};
  return (
    <div className="score">
      {room.players.map((p) => {
        const isTurn = Boolean(currentId && p.id === currentId);
        const squares = room.game?.scores[p.id] ?? 0;
        const lines = strokes[p.id] ?? 0;
        return (
          <div key={p.id} className="score-row" style={nickTile(p.color)} aria-current={isTurn ? "true" : undefined}>
            <span className="score-nick">
              <span className="score-nick-text">{p.nick}</span>
              {isTurn ? (
                <span className="turn-finger" aria-hidden="true">
                  👈
                </span>
              ) : null}
            </span>
            <span className="score-stats">
              <span className="score-stat" aria-label={`${squares} ${squares === 1 ? "quadrado" : "quadrados"}`}>
                <span className="score-pts">{squares}</span>
                <ScoreSquare className="score-unit" />
              </span>
              <span className="score-stat" aria-label={`${lines} ${lines === 1 ? "traço" : "traços"}`}>
                <span className="score-pts">{lines}</span>
                <ScoreStroke className="score-unit" />
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Results({ room }: { room: PublicRoom }) {
  const winnerIds = new Set(room.game?.winnerIds ?? []);
  const ranked = [...room.players].sort(
    (a, b) => (room.game?.scores[b.id] ?? 0) - (room.game?.scores[a.id] ?? 0),
  );
  const winnerNames = ranked.filter((p) => winnerIds.has(p.id));
  const draw = winnerNames.length > 1;

  return (
    <div className="results">
      <h2 className="results-title">{draw ? "Empate" : "Venceu"}</h2>
      <ul className="results-winners">
        {winnerNames.map((p) => (
          <li key={p.id} style={nickTile(p.color)}>
            {p.nick}
          </li>
        ))}
      </ul>
      <ScoreList room={{ ...room, players: ranked }} />
      <a className="btn" href="/">
        Nova sala
      </a>
    </div>
  );
}

function nickTile(color: ColorId): { background: string; color: string } {
  return {
    background: COLOR_HEX[color],
    color: color === "yellow" ? "#141820" : "#fffaf0",
  };
}

function TurnTimer({ deadlineAt, durationMs }: { deadlineAt: number; durationMs: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const leftMs = Math.max(0, deadlineAt - now);
  const leftSec = Math.ceil(leftMs / 1000);
  const frac = Math.max(0, Math.min(1, leftMs / durationMs));
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="timer">
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle className="timer-track" cx="48" cy="48" r={r} />
        <circle
          className="timer-arc"
          cx="48"
          cy="48"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <span className="timer-num">
        {leftSec}
        <small>s</small>
      </span>
      <span className="sr-only" aria-live="polite">
        {leftSec}s
      </span>
    </div>
  );
}

function useGlowFlash(signal: string | null) {
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (!signal) {
      prev.current = null;
      setFlash(null);
      return;
    }
    if (prev.current === signal) return;
    prev.current = signal;
    setFlash(signal);
    const t = setTimeout(() => setFlash(null), BOARD_GLOW_MS);
    return () => clearTimeout(t);
  }, [signal]);

  return flash;
}

function preferRoom(prev: PublicRoom | null | undefined, next: PublicRoom): PublicRoom {
  if (prev && prev.status !== "lobby" && next.status === "lobby") return prev;
  if (prev && next.updatedAt < prev.updatedAt) return prev;
  return next;
}

function edgeTaken(game: GameState, edge: Edge) {
  return edge.orientation === "h"
    ? Boolean(game.horizontal[edge.row]?.[edge.col])
    : Boolean(game.vertical[edge.row]?.[edge.col]);
}

function withPendingMoves(room: PublicRoom, playerId: string, edges: Edge[]): PublicRoom {
  if (!edges.length || !room.game) return room;
  let game = room.game;
  for (const edge of edges) {
    try {
      game = applyMove(game, playerId, edge).state;
    } catch {
      break;
    }
  }
  return { ...room, game };
}

function boardGlow({
  status,
  myTurn,
  currentKind,
  deadlineAt,
  now,
}: {
  status: PublicRoom["status"];
  myTurn: boolean;
  currentKind?: string;
  deadlineAt: number | null;
  now: number;
}): "turn" | "orange" | "red" | null {
  if (status !== "playing" || currentKind !== "human" || !myTurn || !deadlineAt) return null;
  const left = deadlineAt - now;
  if (left <= 5_000) return "red";
  if (left <= 10_000) return "orange";
  return "turn";
}

function WsFlag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="ws-flag" role="status">
      Sem conexão com o servidor
    </div>
  );
}
