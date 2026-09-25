"use client";

import { useEffect, useRef, useState } from "react";
import { applyMove, countEdgesByPlayer, MAX_PLAYERS, type Edge, type GameState } from "@tracinhos/game";
import {
  BOT_THINK_MS,
  BOARD_GLOW_MS,
  COLOR_HEX,
  ERROR_MESSAGES,
  LOBBY_POLL_MS,
  PRESENCE_POLL_MS,
  RESULT_HOLD_MS,
  TURN_TIMEOUT_MS,
  isValidNick,
  type ColorId,
  type PublicRoom,
  type Session,
  type WatchSession,
} from "@tracinhos/shared";
import { Board } from "./Board";
import { ColorPicker } from "./ColorPicker";
import { HelpButton } from "./HelpButton";
import { ScoreSquare, ScoreStroke } from "./Marks";
import { PenIcon } from "./Pen";
import { Toast } from "./Toast";
import { TurnTimer } from "./TurnTimer";
import {
  clearOccupy,
  clearSession,
  clearWatch,
  loadIdentity,
  loadSession,
  loadWatch,
  saveIdentity,
  saveOccupy,
  saveSession,
  saveWatch,
} from "@/lib/session";
import { heartbeatPresence, leavePresenceNow } from "@/lib/presence-client";

export function RoomApp({ code }: { code: string }) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [watch, setWatch] = useState<WatchSession | null>(null);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [nick, setNick] = useState("");
  const [color, setColor] = useState<ColorId>("blue");
  const [toast, setToast] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; nick: string } | null>(null);
  const [wsDown, setWsDown] = useState(false);
  const kickedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<object[]>([]);
  const backoff = useRef(1000);
  const toastMs = useRef(2200);
  const playerIdRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);
  const releasedHoldRef = useRef(false);
  const [, setHoldTick] = useState(0);
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
      const seatToken = loadSession(roomCode)?.seatToken;
      const watchToken = loadWatch(roomCode)?.watchToken;
      const headers: Record<string, string> = {};
      if (seatToken) headers["x-seat-token"] = seatToken;
      else if (watchToken) headers["x-watch-token"] = watchToken;
      const res = await fetch(`/api/rooms/${roomCode}`, {
        cache: "no-store",
        headers,
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
    const seat = loadSession(roomCode);
    const existingWatch = loadWatch(roomCode);
    setSession(seat);
    setWatch(existingWatch);
    const pref = loadIdentity();
    if (pref) {
      setNick(pref.nick);
      setColor(pref.color);
    }
    if (existingWatch && !seat) {
      void (async () => {
        try {
          const res = await fetch(`/api/rooms/${roomCode}/watch/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watchToken: existingWatch.watchToken }),
          });
          const data = await res.json();
          if (!res.ok) {
            clearWatch(roomCode);
            setWatch(null);
            return;
          }
          saveWatch(data.watch);
          setWatch(data.watch);
          setRoom((prev) => preferRoom(prev, data.room));
        } catch {
          /* rede */
        }
      })();
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
        if (message.type === "room:kicked") {
          kickedRef.current = true;
          clearSession(roomCode);
          clearOccupy();
          setSession(null);
          toastMs.current = 2800;
          setToast("O host te tirou da sala.");
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
        if (stopped || elsewhere || kickedRef.current) return;
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

  if (room?.status === "playing") {
    wasPlayingRef.current = true;
    releasedHoldRef.current = false;
  }
  const holdingBoard =
    room?.status === "finished" && wasPlayingRef.current && !releasedHoldRef.current;

  useEffect(() => {
    if (room?.status !== "finished" || !wasPlayingRef.current || releasedHoldRef.current) return;
    const t = setTimeout(() => {
      releasedHoldRef.current = true;
      setHoldTick((n) => n + 1);
    }, RESULT_HOLD_MS);
    return () => clearTimeout(t);
  }, [room?.status]);

  useEffect(() => {
    if (!room) return;
    if ((session || watch) && (room.status === "lobby" || room.status === "playing")) {
      saveOccupy(room.code, session ? "seated" : "watching");
      return;
    }
    if (room.status === "finished") clearOccupy();
    if (watch && room.status === "lobby") {
      clearWatch(room.code);
      setWatch(null);
    }
  }, [room?.status, room?.code, session?.seatToken, watch?.watchToken]);

  useEffect(() => {
    if (!room || !session) return;
    if (room.status !== "lobby") return;
    if (room.players.some((p) => p.id === session.playerId)) return;
    if (!kickedRef.current) {
      kickedRef.current = true;
      toastMs.current = 2800;
      setToast("O host te tirou da sala.");
    }
    clearSession(room.code);
    clearOccupy();
    setSession(null);
  }, [room, session]);

  useEffect(() => {
    if (elsewhere || room === null) return;

    async function beat() {
      if (document.visibilityState === "hidden") return;
      const current = roomRef.current;
      const identNick = session?.nick ?? watch?.nick ?? nick;
      const identColor = session?.color ?? watch?.color ?? color;
      if (!isValidNick(identNick)) return;
      const occupying =
        current && (current.status === "lobby" || current.status === "playing") && (session || watch)
          ? { roomCode: current.code, role: (session ? "seated" : "watching") as "seated" | "watching" }
          : null;
      await heartbeatPresence({
        nick: identNick,
        color: identColor,
        occupying,
      }).catch(() => null);
    }

    void beat();
    const id = setInterval(() => void beat(), PRESENCE_POLL_MS);
    const onPageHide = () => leavePresenceNow();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [elsewhere, room === null, room?.status, room?.code, session?.seatToken, session?.nick, session?.color, watch?.watchToken, watch?.nick, watch?.color, nick, color]);

  useEffect(() => {
    return () => {
      const ident = loadIdentity();
      const seat = loadSession(roomCode);
      const watching = loadWatch(roomCode);
      const identNick = seat?.nick ?? watching?.nick ?? ident?.nick ?? "";
      const identColor = seat?.color ?? watching?.color ?? ident?.color ?? "blue";
      if (isValidNick(identNick)) {
        void heartbeatPresence({ nick: identNick, color: identColor, occupying: null });
      }
      clearOccupy();
    };
  }, [roomCode]);

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

  async function startWatch() {
    const res = await fetch(`/api/rooms/${roomCode}/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, color }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    saveWatch(data.watch);
    saveIdentity({ nick: data.watch.nick, color: data.watch.color });
    setWatch(data.watch);
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

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setToast("Código copiado");
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

  const watchers = room.watchers ?? [];
  const activeWatch = watch && room.status !== "lobby" ? watch : null;
  const isSpectator = Boolean(activeWatch && !session);

  if (!session && !activeWatch) {
    if (room.status === "finished") {
      return (
        <main className="page">
          <Results room={room} canCreate={false} />
          <Toast message={toast} />
        </main>
      );
    }
    const watching = room.status === "playing";
    const takenColors = watching ? watchers.map((w) => w.color) : room.takenColors;
    return (
      <main className="page">
        <RoomCodeBlock code={room.code} count={room.players.length} onCopyCode={() => void copyCode()} />
        <p className="lede">
          Já na sala: {room.players.map((p) => p.nick).join(", ") || "ninguém ainda"}
        </p>
        <section className="stage">
          <h2>{watching ? "Assistir" : "Entrar"}</h2>
          <div className="field">
            <label htmlFor="nick">Seu nick</label>
            <input id="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
          </div>
          <div className="field">
            <label>Sua cor</label>
            <ColorPicker value={color} taken={takenColors} onChange={setColor} />
          </div>
          <button
            className="btn"
            disabled={takenColors.includes(color)}
            onClick={() => void (watching ? startWatch() : sit())}
          >
            {watching ? "Assistir" : "Entrar"}
          </button>
        </section>
        <Toast message={toast} />
      </main>
    );
  }

  const isHost = Boolean(session && session.playerId === room.hostPlayerId);
  const starterPlayer =
    room.starterPlayerId ? room.players.find((p) => p.id === room.starterPlayerId) : undefined;
  const starterValue = starterPlayer?.id ?? "";
  const viewRoom = session ? withPendingMoves(room, session.playerId, pendingEdges) : room;
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  const serverMyTurn = Boolean(session && room.status === "playing" && currentId === session.playerId);
  const localMyTurn = Boolean(
    session &&
      viewRoom.game?.status === "playing" &&
      viewRoom.game.playerIds[viewRoom.game.currentPlayerIndex] === session.playerId,
  );
  const myTurn = !isSpectator && (serverMyTurn || localMyTurn);
  const canDraw = !isSpectator && (localMyTurn || (serverMyTurn && pendingEdges.length === 0));
  const showBoard = room.status === "playing" || (room.status === "finished" && holdingBoard);
  const timerMs = current?.kind === "bot" ? BOT_THINK_MS : TURN_TIMEOUT_MS;

  if (room.status === "finished" && !holdingBoard) {
    return (
      <main className="page">
        <Results room={room} canCreate={!isSpectator} />
        <Toast message={toast} />
        {wsFlag}
      </main>
    );
  }

  if (showBoard) {
    const turnColor = current ? COLOR_HEX[current.color] : "#888";
    return (
      <main className="page page-play">
        <div className="hud">
          <div className="hud-top">
            <div className={`turn ${myTurn ? "you" : ""} ${isSpectator ? "watching" : ""}`}>
              <span className="turn-pen" style={{ color: turnColor }}>
                <PenIcon size={28} />
              </span>
              {isSpectator ? (
                <span>
                  Assistindo
                  <small className="hint">Vez de {current?.nick ?? "…"}</small>
                </span>
              ) : myTurn ? (
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
            <div className="hud-tools">
              {!isSpectator && watchers.length > 0 ? (
                <WatchersEye
                  watchers={watchers}
                  open={watchersOpen}
                  onToggle={() => setWatchersOpen((v) => !v)}
                  onClose={() => setWatchersOpen(false)}
                />
              ) : null}
              <HelpButton />
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
          borderColor={isSpectator ? null : borderColor}
          flash={isSpectator ? null : flash}
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
      <RoomCodeBlock code={room.code} count={room.players.length} onCopyCode={() => void copyCode()} />
      <button className="btn ghost copy-link" onClick={() => void copyLink()}>
        Copiar link
      </button>

      <section className="stage">
        <div className="field starter">
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
        <ul className="list">
          {room.players.map((p) => (
            <li key={p.id} style={nickTile(p.color)}>
              <span className="list-nick">
                {p.nick}
                {p.id === room.hostPlayerId ? " · host" : ""}
                {p.kind === "bot" ? " · bot" : ""}
              </span>
              {isHost && p.id !== room.hostPlayerId ? (
                <button
                  type="button"
                  className="list-remove"
                  aria-label={`Remover ${p.nick}`}
                  onClick={() => setPendingRemove({ id: p.id, nick: p.nick })}
                >
                  Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
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
      {pendingRemove ? (
        <ConfirmRemove
          nick={pendingRemove.nick}
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            send({ type: "room:removePlayer", playerId: pendingRemove.id });
            setPendingRemove(null);
          }}
        />
      ) : null}
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

function Results({ room, canCreate = true }: { room: PublicRoom; canCreate?: boolean }) {
  const winnerIds = new Set(room.game?.winnerIds ?? []);
  const ranked = [...room.players].sort(
    (a, b) => (room.game?.scores[b.id] ?? 0) - (room.game?.scores[a.id] ?? 0),
  );
  const winnerNames = ranked.filter((p) => winnerIds.has(p.id));
  const draw = winnerNames.length > 1;

  return (
    <div className="results">
      <h2 className="results-title">{draw ? "Empate" : "Vencedor"}</h2>
      <ul className="results-winners">
        {winnerNames.map((p) => (
          <li key={p.id} style={nickTile(p.color)}>
            {p.nick}
          </li>
        ))}
      </ul>
      <ScoreList room={{ ...room, players: ranked }} />
      <a className="btn" href="/">
        {canCreate ? "Nova sala" : "Voltar ao lobby"}
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
  const normalized = { ...next, watchers: next.watchers ?? [] };
  if (prev && prev.status !== "lobby" && normalized.status === "lobby") return prev;
  if (prev && normalized.updatedAt < prev.updatedAt) return prev;
  return normalized;
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

function RoomCodeBlock({
  code,
  count,
  onCopyCode,
}: {
  code: string;
  count: number;
  onCopyCode: () => void;
}) {
  return (
    <div className="room-code-block">
      <button type="button" className="room-code" onClick={onCopyCode} aria-label={`Código ${code}, copiar`}>
        {code}
      </button>
      <p className="occupancy" aria-label={`${count} de ${MAX_PLAYERS} jogadores`}>
        {count}/{MAX_PLAYERS}
      </p>
    </div>
  );
}

function WatchersEye({
  watchers,
  open,
  onToggle,
  onClose,
}: {
  watchers: { id: string; nick: string; color: ColorId }[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const n = watchers.length;
  if (n === 0) return null;
  return (
    <div className="watchers-wrap">
      <button
        type="button"
        className="icon-btn watchers-btn"
        aria-label={`${n} assistindo`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <EyeIcon />
        <span>{n}</span>
      </button>
      {open ? (
        <>
          <button className="watchers-scrim" aria-label="Fechar" onClick={onClose} />
          <div className="watchers-balloon" role="dialog" aria-label="Quem assiste">
            <ul>
              {watchers.map((w) => (
                <li key={w.id}>
                  <span className="turn-pen" style={{ color: COLOR_HEX[w.color] }}>
                    <PenIcon size={18} />
                  </span>
                  {w.nick}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c5.2 0 9.3 3.4 10.7 7-1.4 3.6-5.5 7-10.7 7S2.7 15.6 1.3 12C2.7 8.4 6.8 5 12 5Zm0 3.2A3.8 3.8 0 1 0 12 16a3.8 3.8 0 0 0 0-7.8Zm0 2.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z"
      />
    </svg>
  );
}

function ConfirmRemove({
  nick,
  onCancel,
  onConfirm,
}: {
  nick: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="sheet-root center">
      <button className="sheet-backdrop" aria-label="Cancelar remoção" onClick={onCancel} />
      <div
        ref={panelRef}
        className="confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-remove-title"
        aria-describedby="confirm-remove-copy"
      >
        <h2 id="confirm-remove-title">Remover {nick}?</h2>
        <p id="confirm-remove-copy">Tem certeza? {nick} sai da sala.</p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn danger" type="button" onClick={onConfirm}>
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

function WsFlag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="ws-flag" role="status">
      Sem conexão com o servidor
    </div>
  );
}
