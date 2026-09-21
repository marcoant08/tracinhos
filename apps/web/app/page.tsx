"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TALL_GRID } from "@tracinhos/game";
import { COLOR_IDS, type ColorId } from "@tracinhos/shared";
import { ColorPicker } from "@/components/ColorPicker";
import { Toast } from "@/components/Toast";
import { loadIdentity, saveIdentity, saveSession } from "@/lib/session";

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

  useEffect(() => {
    const pref = loadIdentity();
    if (!pref) return;
    setNick(pref.nick);
    setColor(pref.color);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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
      saveIdentity({ nick: data.session.nick, color: data.session.color });
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

  return (
    <main className="page">
      <header className="brand">
        <h1>Tracinhos</h1>
        <p>Ligue os pontos. Feche o quadrado. Jogue de novo.</p>
        <a className="text-link" href="/regras">
          Regras do jogo
        </a>
      </header>

      <section className="card">
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

      <section className="card">
        <h2>Entrar</h2>
        <div className="field">
          <label htmlFor="code">Código da sala</label>
          <input
            id="code"
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
