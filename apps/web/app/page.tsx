"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_PLAYERS, TALL_GRID } from "@tracinhos/game";
import {
  COLOR_HEX,
  COLOR_IDS,
  ERROR_MESSAGES,
  PRESENCE_POLL_MS,
  type ColorId,
  type LobbySnapshot,
} from "@tracinhos/shared";
import { ColorPicker } from "@/components/ColorPicker";
import { PenIcon } from "@/components/Pen";
import { Toast } from "@/components/Toast";
import {
  loadGridPref,
  loadIdentity,
  loadOccupy,
  loadPresence,
  saveGridPref,
  saveIdentity,
  savePresence,
  saveSession,
} from "@/lib/session";

const GRID_OPTIONS = [
  ...Array.from({ length: 9 }, (_, i) => {
    const n = i + 2;
    return { cols: n, rows: n, label: `${n}×${n} (${n * n} quadrados)` };
  }),
  {
    cols: TALL_GRID.cols,
    rows: TALL_GRID.rows,
    label: "10×15 pontos (126 quadrados)",
  },
];

function gridKey(cols: number, rows: number) {
  return `${cols}x${rows}`;
}

export default function HomePage() {
  const router = useRouter();
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [nick, setNick] = useState("");
  const [color, setColor] = useState<ColorId>(COLOR_IDS[0]);
  const [joinCode, setJoinCode] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lobby, setLobby] = useState<LobbySnapshot>({
    online: [],
    live: [],
    inbox: null,
    outgoing: null,
    accepted: null,
  });
  const nickRef = useRef(nick);
  const colorRef = useRef(color);
  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);
  nickRef.current = nick;
  colorRef.current = color;
  colsRef.current = cols;
  rowsRef.current = rows;

  useEffect(() => {
    const pref = loadIdentity();
    if (pref) {
      setNick(pref.nick);
      setColor(pref.color);
    }
    const grid = loadGridPref();
    if (!grid) return;
    setCols(grid.cols);
    setRows(grid.rows);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      if (document.visibilityState === "hidden") return;
      try {
        const pingData = await heartbeatPresence({
          nick: nickRef.current,
          color: colorRef.current,
          cols: colsRef.current,
          rows: rowsRef.current,
        });
        if (!pingData) return;

        const res = await fetch("/api/lobby", {
          cache: "no-store",
          headers: { "x-presence-token": pingData.presence.presenceToken },
        });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as LobbySnapshot;
        if (next.accepted) {
          saveSession(next.accepted.session);
          router.push(`/sala/${next.accepted.roomCode}`);
          return;
        }
        setLobby(next);
      } catch {
        /* rede */
      }
    }

    void tick();
    const id = setInterval(tick, PRESENCE_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cols, rows, nick, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.message ?? "Não deu para criar.");
        return;
      }
      saveSession(data.session);
      saveIdentity({ nick: data.session.nick, color: data.session.color, cols, rows });
      router.push(`/sala/${data.session.roomCode}`);
    } finally {
      setBusy(false);
    }
  }

  function goJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setToast("Digite o código da sala.");
      return;
    }
    router.push(`/sala/${code}`);
  }

  async function challenge(toPresenceId: string) {
    const token = loadPresence()?.presenceToken;
    if (!token) {
      setToast("Aguarde um instante e tente de novo.");
      return;
    }
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-presence-token": token },
      body: JSON.stringify({ toPresenceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    setToast("Desafio enviado.");
  }

  async function accept() {
    const token = loadPresence()?.presenceToken;
    if (!token || !lobby.inbox) return;
    const res = await fetch(`/api/challenges/${lobby.inbox.id}/accept`, {
      method: "POST",
      headers: { "x-presence-token": token },
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    saveSession(data.session);
    saveIdentity({ nick: data.session.nick, color: data.session.color });
    router.push(`/sala/${data.session.roomCode}`);
  }

  async function decline() {
    const token = loadPresence()?.presenceToken;
    if (!token || !lobby.inbox) return;
    const res = await fetch(`/api/challenges/${lobby.inbox.id}/decline`, {
      method: "POST",
      headers: { "x-presence-token": token },
    });
    if (!res.ok) {
      const data = await res.json();
      setToast(data.message ?? "Não deu para recusar.");
      return;
    }
    setLobby((prev) => ({ ...prev, inbox: null }));
  }

  return (
    <main className="page page-lobby">
      {lobby.inbox ? (
        <div className="challenge-banner" role="status">
          <p>
            <strong>{lobby.inbox.from.nick}</strong> te desafiou
            <small>
              {lobby.inbox.cols}×{lobby.inbox.rows}
            </small>
          </p>
          <div className="challenge-actions">
            <button className="btn" type="button" onClick={() => void accept()}>
              Aceitar
            </button>
            <button className="btn ghost" type="button" onClick={() => void decline()}>
              Recusar
            </button>
          </div>
        </div>
      ) : null}

      <p className="lede">Ligue os pontos. Feche o quadrado. Jogue de novo.</p>

      <div className="home-lists">
        <section className="home-list">
          <h2>Online</h2>
          {lobby.online.length === 0 ? (
            <p className="empty-note">Ninguém online agora.</p>
          ) : (
            <ul className="people-list">
              {lobby.online.map((person) => (
                <li key={person.presenceId}>
                  <span className="person-nick">
                    <span className="turn-pen" style={{ color: COLOR_HEX[person.color] }}>
                      <PenIcon size={20} />
                    </span>
                    {person.nick}
                  </span>
                  <button
                    type="button"
                    className="btn ghost compact"
                    aria-label={`Desafiar ${person.nick}`}
                    disabled={Boolean(lobby.outgoing)}
                    onClick={() => void challenge(person.presenceId)}
                  >
                    Desafiar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-list">
          <h2>Ao vivo</h2>
          {lobby.live.length === 0 ? (
            <p className="empty-note">Nenhuma partida agora.</p>
          ) : (
            <ul className="live-list">
              {lobby.live.map((live) => {
                const scores = live.players.map((p) => p.squares).join("–");
                const names = live.players.map((p) => p.nick).join(", ");
                return (
                  <li key={live.code}>
                    <a
                      className="live-row"
                      href={`/sala/${live.code}`}
                      aria-label={`Assistir ${names}`}
                    >
                      <span className="live-people">
                        {live.players.map((p) => (
                          <span key={p.nick} className="live-player">
                            <span className="turn-pen" style={{ color: COLOR_HEX[p.color] }}>
                              <PenIcon size={16} />
                            </span>
                            {p.nick}
                          </span>
                        ))}
                      </span>
                      <span className="live-meta">
                        <strong>{scores}</strong>
                        <span>
                          {live.cols}×{live.rows}
                        </span>
                        <span>
                          {live.players.length}/{MAX_PLAYERS}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="stage">
        <h2>Criar sala</h2>
        <div className="field">
          <label htmlFor="size">Tamanho da grade</label>
          <select
            id="size"
            className="select-size"
            value={gridKey(cols, rows)}
            onChange={(e) => {
              const next = GRID_OPTIONS.find((g) => gridKey(g.cols, g.rows) === e.target.value);
              if (!next) return;
              setCols(next.cols);
              setRows(next.rows);
              saveGridPref(next);
            }}
          >
            {GRID_OPTIONS.map((g) => (
              <option key={gridKey(g.cols, g.rows)} value={gridKey(g.cols, g.rows)}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nick">Seu nick</label>
          <input
            id="nick"
            value={nick}
            maxLength={16}
            autoComplete="nickname"
            onChange={(e) => setNick(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Sua cor</label>
          <ColorPicker value={color} taken={[]} onChange={setColor} />
        </div>
        <button className="btn" disabled={busy} onClick={() => void create()}>
          Criar sala
        </button>
      </section>

      <section className="join-beat">
        <h2>Entrar</h2>
        <div className="field">
          <label htmlFor="code">Código da sala</label>
          <input
            id="code"
            className="join-code"
            value={joinCode}
            maxLength={4}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="AB3K"
          />
        </div>
        <button className="btn ghost" onClick={goJoin}>
          Ir para a sala
        </button>
      </section>
      <Toast message={toast} />
    </main>
  );
}

async function heartbeatPresence(input: {
  nick: string;
  color: ColorId;
  cols: number;
  rows: number;
}): Promise<{ presenceId: string; presenceToken: string } | null> {
  const body = {
    nick: input.nick,
    color: input.color,
    cols: input.cols,
    rows: input.rows,
    occupying: loadOccupy(),
  };
  let token = loadPresence()?.presenceToken ?? "";
  for (let i = 0; i < 2; i++) {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, presenceToken: token }),
    });
    const data = (await res.json()) as {
      presence?: { presenceId: string; presenceToken: string };
      error?: string;
    };
    if (res.ok && data.presence) {
      savePresence(data.presence);
      return data.presence;
    }
    if (data.error !== "invalid_token") return null;
    token = "";
  }
  return null;
}
