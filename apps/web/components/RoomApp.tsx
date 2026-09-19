"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COLOR_HEX, COLOR_IDS, ERROR_MESSAGES, type ColorId, type PublicRoom, type Session } from "@tracinhos/shared";
import { Board } from "./Board";
import { ColorPicker } from "./ColorPicker";
import { clearSession, loadSession, saveSession } from "@/lib/session";

export function RoomApp({ code }: { code: string }) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<PublicRoom | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [nick, setNick] = useState("");
  const [color, setColor] = useState<ColorId>("blue");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<object[]>([]);
  const backoff = useRef(1000);

  function flush(ws: WebSocket) {
    while (queueRef.current.length && ws.readyState === WebSocket.OPEN) {
      const payload = queueRef.current.shift();
      if (payload) ws.send(JSON.stringify(payload));
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
    void fetch(`/api/rooms/${roomCode}`)
      .then(async (res) => {
        if (res.status === 404) {
          setRoom(null);
          return;
        }
        setRoom((await res.json()) as PublicRoom);
      })
      .catch(() => setRoom(null));
  }, [roomCode]);

  useEffect(() => {
    if (!session || elsewhere) return;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
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
        const message = JSON.parse(event.data as string);
        if (message.type === "session") {
          saveSession(message.session);
          setSession(message.session);
        }
        if (message.type === "game:state" || message.type === "game:over") {
          setRoom(message.room);
          setError(null);
        }
        if (message.type === "room:error") {
          if (message.error === "invalid_token" || message.error === "room_not_found") {
            clearSession(roomCode);
            setSession(null);
          }
          setError(message.message);
          setToast(message.message);
        }
        if (message.type === "resumed_elsewhere") {
          setElsewhere(true);
          ws.close();
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
    const t = setTimeout(() => setToast(null), 2200);
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
    setError(null);
    const res = await fetch(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, color }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    saveSession(data.session);
    setSession(data.session);
    setRoom(data.room);
  }

  if (room === undefined) {
    return (
      <main className="page">
        <p>Carregando sala…</p>
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
      </main>
    );
  }

  if (elsewhere) {
    return (
      <main className="page">
        <div className="card">
          <h2>Você abriu o jogo noutra aba.</h2>
        </div>
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
            Sentar
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

  const me = room.players.find((p) => p.id === session.playerId);
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  const myTurn = room.status === "playing" && currentId === session.playerId;

  return (
    <main className="page">
      {room.status !== "lobby" ? (
        <div className="hud">
          <div className={`turn ${myTurn ? "you" : ""}`}>
            {room.status === "finished" ? (
              winnersLabel(room)
            ) : (
              <>
                <span className="dot" style={{ background: current ? COLOR_HEX[current.color] : "#888" }} />
                {myTurn ? "Sua vez" : `Vez de ${current?.nick ?? "…"}`}
              </>
            )}
          </div>
          <div className="score">
            {room.players.map((p) => (
              <span key={p.id} className="chip">
                <span className="dot" style={{ background: COLOR_HEX[p.color] }} />
                {p.nick} {room.game?.scores[p.id] ?? 0}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="brand">
          <p className="code">{room.code}</p>
          <button
            className="btn ghost"
            onClick={() => void navigator.clipboard.writeText(room.code)}
          >
            Copiar código
          </button>
        </div>
      )}

      {room.status === "lobby" ? (
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
            <p>Esperando o host…</p>
          )}
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : (
        <Board
          room={room}
          canDraw={myTurn}
          onDraw={(edge) => send({ type: "game:draw", edge })}
        />
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

function winnersLabel(room: PublicRoom) {
  const ids = room.game?.winnerIds ?? [];
  const names = ids.map((id) => room.players.find((p) => p.id === id)?.nick ?? id);
  if (names.length > 1) return `Empate: ${names.join(", ")}`;
  return `Venceu ${names[0] ?? "alguém"}`;
}
