"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_HEX,
  COLOR_IDS,
  ERROR_MESSAGES,
  TURN_TIMEOUT_MS,
  type ColorId,
  type PublicRoom,
  type Session,
} from "@tracinhos/shared";
import { Board } from "./Board";
import { ColorPicker } from "./ColorPicker";
import { Toast } from "./Toast";
import { clearSession, loadSession, saveSession } from "@/lib/session";

export function RoomApp({ code }: { code: string }) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [nick, setNick] = useState("");
  const [color, setColor] = useState<ColorId>("blue");
  const [toast, setToast] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<object[]>([]);
  const backoff = useRef(1000);
  const toastMs = useRef(2200);
  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = session?.playerId ?? null;

  function flush(ws: WebSocket) {
    while (queueRef.current.length && ws.readyState === WebSocket.OPEN) {
      const payload = queueRef.current.shift();
      if (payload) ws.send(JSON.stringify(payload));
    }
  }

  async function refreshRoom() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, { cache: "no-store" });
      if (res.status === 404) {
        setRoom(null);
        return;
      }
      if (res.ok) setRoom((await res.json()) as PublicRoom);
    } catch {
      /* rede */
    }
  }

  function send(payload: object) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    queueRef.current.push(payload);
  }

  useEffect(() => {
    setSession(loadSession(roomCode));
    void refreshRoom();
  }, [roomCode]);

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
          setRoom(message.room);
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
        ws.send(
          JSON.stringify({
            type: "room:resume",
            roomCode: session.roomCode,
            seatToken: session.seatToken,
          }),
        );
        flush(ws);
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

  const freeColor = useMemo(() => {
    const taken = room?.takenColors ?? [];
    return COLOR_IDS.find((id) => !taken.includes(id)) ?? "blue";
  }, [room]);

  useEffect(() => {
    if (!session && room && room.takenColors.includes(color)) {
      setColor(freeColor);
    }
  }, [room, session, color, freeColor]);

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
        <div className="card">
          <h2>Sala não encontrada</h2>
          <a href="/">Voltar ao lobby</a>
        </div>
        <Toast message={toast} />
      </main>
    );
  }

  if (elsewhere) {
    return (
      <main className="page">
        <div className="card">
          <h2>Você abriu o jogo noutra aba.</h2>
        </div>
        <Toast message={toast} />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page">
        <div className="brand">
          <h1>Sala {room.code}</h1>
          <p>Já na sala: {room.players.map((p) => p.nick).join(", ") || "ninguém ainda"}</p>
        </div>
        <div className="card">
          <div className="field">
            <label htmlFor="nick">Seu nick</label>
            <input id="nick" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
          </div>
          <div className="field">
            <label>Sua cor</label>
            <ColorPicker value={color} taken={room.takenColors} onChange={setColor} />
          </div>
          <button className="btn" onClick={() => void sit()}>
            Entrar
          </button>
        </div>
        <p>
          <a className="text-link" href="/regras">
            Regras do jogo
          </a>
        </p>
        <Toast message={toast} />
      </main>
    );
  }

  const me = room.players.find((p) => p.id === session.playerId);
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  const myTurn = room.status === "playing" && currentId === session.playerId;

  if (room.status === "finished") {
    return (
      <main className="page">
        <Results room={room} />
        <Toast message={toast} />
      </main>
    );
  }

  if (room.status === "playing") {
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
              {room.turnDeadlineAt ? <TurnTimer deadlineAt={room.turnDeadlineAt} /> : null}
            </div>
          </div>
          <ScoreList room={room} />
        </div>
        <Board room={room} canDraw={myTurn} onDraw={(edge) => send({ type: "game:draw", edge })} />
        <Toast message={toast} />
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

      <div className="card">
        <ul className="list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: COLOR_HEX[p.color] }} />
              {p.nick}
              {p.id === room.hostPlayerId ? " · host" : ""}
              {p.kind === "bot" ? " · bot" : ""}
            </li>
          ))}
        </ul>
        {me && session.playerId === room.hostPlayerId ? (
          <>
            <button
              className="btn ghost"
              style={{ marginBottom: 10 }}
              onClick={() => {
                send({ type: "room:addBot" });
                window.setTimeout(() => void refreshRoom(), 250);
              }}
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
          <p>Esperando o host…</p>
        )}
      </div>
      <Toast message={toast} />
    </main>
  );
}

function ScoreList({ room }: { room: PublicRoom }) {
  return (
    <div className="score">
      {room.players.map((p) => (
        <div key={p.id} className="score-row">
          <span className="dot" style={{ background: COLOR_HEX[p.color] }} />
          <span className="score-nick">{p.nick}</span>
          <span className="score-pts">{room.game?.scores[p.id] ?? 0}</span>
        </div>
      ))}
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
    <div className="card results">
      <h2>Fim de jogo</h2>
      <p className="results-title">{draw ? "Empate" : "Venceu"}</p>
      <ul className="results-winners">
        {winnerNames.map((p) => (
          <li key={p.id}>
            <span className="dot dot-lg" style={{ background: COLOR_HEX[p.color] }} />
            {p.nick}
          </li>
        ))}
      </ul>
      <ScoreList room={{ ...room, players: ranked }} />
      <a className="btn" href="/">
        Nova sala
      </a>
      <a className="text-link" href="/regras" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
        Regras
      </a>
    </div>
  );
}

function TurnTimer({ deadlineAt }: { deadlineAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const leftMs = Math.max(0, deadlineAt - now);
  const leftSec = Math.ceil(leftMs / 1000);
  const frac = Math.max(0, Math.min(1, leftMs / TURN_TIMEOUT_MS));
  const r = 15;
  const c = 2 * Math.PI * r;

  return (
    <div className="timer">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#3d3228" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--accent-2)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 20 20)"
        />
        <text className="timer-num" x="20" y="20.5" textAnchor="middle" dominantBaseline="middle">
          {leftSec}s
        </text>
      </svg>
      <span className="sr-only" aria-live="polite">
        {leftSec}s
      </span>
    </div>
  );
}
