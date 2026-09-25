"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_PLAYERS, TALL_GRID } from "@tracinhos/game";
import {
  COLOR_HEX,
  COLOR_IDS,
  ERROR_MESSAGES,
  PRESENCE_POLL_MS,
  isValidNick,
  type ColorId,
  type LobbySnapshot,
} from "@tracinhos/shared";
import { ColorPicker } from "@/components/ColorPicker";
import { PenIcon } from "@/components/Pen";
import { Toast } from "@/components/Toast";
import {
  clearOccupy,
  loadGridPref,
  loadIdentity,
  loadPresence,
  loadSession,
  saveGridPref,
  saveIdentity,
  saveSession,
} from "@/lib/session";
import { fetchLobby, heartbeatPresence, leavePresenceNow } from "@/lib/presence-client";

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
  const [myLiveCodes, setMyLiveCodes] = useState<string[]>([]);
  const nickRef = useRef(nick);
  const colorRef = useRef(color);
  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);
  nickRef.current = nick;
  colorRef.current = color;
  colsRef.current = cols;
  rowsRef.current = rows;

  const publishRef = useRef<(overrides?: { nick?: string; color?: ColorId }) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    setMyLiveCodes(lobby.live.filter((live) => loadSession(live.code)).map((live) => live.code));
  }, [lobby.live]);

  useEffect(() => {
    const pref = loadIdentity();
    if (pref) {
      setNick(pref.nick);
      setColor(pref.color);
      nickRef.current = pref.nick;
      colorRef.current = pref.color;
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
    clearOccupy();

    async function publish(overrides?: { nick?: string; color?: ColorId }) {
      if (document.visibilityState === "hidden") return;
      try {
        const pingData = await heartbeatPresence({
          nick: overrides?.nick ?? nickRef.current,
          color: overrides?.color ?? colorRef.current,
          cols: colsRef.current,
          rows: rowsRef.current,
        }).catch(() => null);

        const next = await fetchLobby(pingData?.presenceToken);
        if (!next || stopped) return;
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

    publishRef.current = publish;
    void publish();
    const id = setInterval(() => void publish(), PRESENCE_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        leavePresenceNow();
        return;
      }
      void publish();
    };
    const onPageHide = () => leavePresenceNow();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [router]);

  function commitNick(value: string) {
    const chosen = value.trim();
    nickRef.current = chosen;
    if (chosen !== nick) setNick(chosen);
    if (isValidNick(chosen)) {
      saveIdentity({
        nick: chosen,
        color: colorRef.current,
        cols: colsRef.current,
        rows: rowsRef.current,
      });
    }
    void publishRef.current({ nick: chosen });
  }

  function commitColor(next: ColorId) {
    setColor(next);
    colorRef.current = next;
    if (!isValidNick(nickRef.current)) return;
    saveIdentity({
      nick: nickRef.current,
      color: next,
      cols: colsRef.current,
      rows: rowsRef.current,
    });
    void publishRef.current({ color: next });
  }

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
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      if (data.error === "challenge_gone") {
        setToast("Essa pessoa não está mais online.");
        setLobby((prev) => ({
          ...prev,
          online: prev.online.filter((person) => person.presenceId !== toPresenceId),
        }));
        void publishRef.current();
        return;
      }
      setToast(data.message ?? ERROR_MESSAGES[data.error as keyof typeof ERROR_MESSAGES]);
      return;
    }
    setToast("Desafio enviado.");
    void publishRef.current();
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
              {lobby.online.map((person) => {
                const playing = person.status === "seated";
                return (
                  <li key={person.presenceId}>
                    <span className="person-nick">
                      <span className="turn-pen" style={{ color: COLOR_HEX[person.color] }}>
                        <PenIcon size={20} />
                      </span>
                      {person.nick}
                    </span>
                    <button
                      type="button"
                      className={playing ? "btn compact playing" : "btn ghost compact"}
                      aria-label={playing ? `${person.nick} está jogando` : `Desafiar ${person.nick}`}
                      disabled={playing || Boolean(lobby.outgoing)}
                      onClick={() => {
                        if (playing) return;
                        void challenge(person.presenceId);
                      }}
                    >
                      {playing ? "Jogando" : "Desafiar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="home-list">
          <h2>Ao vivo</h2>
          {lobby.live.length === 0 ? (
            <p className="empty-note">Nenhuma partida agora.</p>
          ) : (
            <ul className="live-list">
              {[...lobby.live]
                .sort((a, b) => Number(myLiveCodes.includes(b.code)) - Number(myLiveCodes.includes(a.code)))
                .map((live) => {
                  const scores = live.players.map((p) => p.squares).join("–");
                  const names = live.players.map((p) => p.nick).join(", ");
                  const mine = myLiveCodes.includes(live.code);
                  return (
                    <li key={live.code}>
                      <a
                        className={mine ? "live-row mine" : "live-row"}
                        href={`/sala/${live.code}`}
                        aria-label={mine ? `Voltar para sua partida com ${names}` : `Assistir ${names}`}
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
                          {mine ? <span className="live-yours">Sua partida</span> : null}
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
            onBlur={() => commitNick(nick)}
          />
        </div>
        <div className="field">
          <label>Sua cor</label>
          <ColorPicker value={color} taken={[]} onChange={commitColor} />
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
