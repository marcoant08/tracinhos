import { TALL_GRID } from "@tracinhos/game";
import {
  IDENTITY_KEY,
  PRESENCE_KEY,
  isColorId,
  isValidNick,
  sessionStorageKey,
  watchStorageKey,
  type ColorId,
  type PresenceRecord,
  type Session,
  type WatchSession,
} from "@tracinhos/shared";

export type IdentityPref = { nick: string; color: ColorId };
export type GridPref = { cols: number; rows: number };

export function loadIdentity(): IdentityPref | null {
  const parsed = readIdentityRaw();
  if (!parsed) return null;
  if (typeof parsed.nick !== "string" || !isValidNick(parsed.nick) || !isColorId(String(parsed.color ?? ""))) {
    return null;
  }
  return { nick: parsed.nick, color: parsed.color as ColorId };
}

export function loadGridPref(): GridPref | null {
  const parsed = readIdentityRaw();
  if (!parsed) return null;
  if (typeof parsed.cols !== "number" || typeof parsed.rows !== "number") return null;
  if (!isKnownGrid(parsed.cols, parsed.rows)) return null;
  return { cols: parsed.cols, rows: parsed.rows };
}

export function saveIdentity(pref: IdentityPref & Partial<GridPref>) {
  const prev = readIdentityRaw() ?? {};
  const next: Record<string, unknown> = { ...prev, nick: pref.nick, color: pref.color };
  if (pref.cols != null && pref.rows != null && isKnownGrid(pref.cols, pref.rows)) {
    next.cols = pref.cols;
    next.rows = pref.rows;
  }
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
}

export function saveGridPref(grid: GridPref) {
  if (typeof window === "undefined" || !isKnownGrid(grid.cols, grid.rows)) return;
  const prev = readIdentityRaw() ?? {};
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...prev, cols: grid.cols, rows: grid.rows }));
}

function isKnownGrid(cols: number, rows: number) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) return false;
  if (cols === TALL_GRID.cols && rows === TALL_GRID.rows) return true;
  return cols === rows && cols >= 2 && cols <= 10;
}

function readIdentityRaw(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function loadSession(roomCode: string): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(sessionStorageKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(sessionStorageKey(session.roomCode), JSON.stringify(session));
}

export function clearSession(roomCode: string) {
  localStorage.removeItem(sessionStorageKey(roomCode));
}

export function loadWatch(roomCode: string): WatchSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(watchStorageKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WatchSession;
  } catch {
    return null;
  }
}

export function saveWatch(watch: WatchSession) {
  localStorage.setItem(watchStorageKey(watch.roomCode), JSON.stringify(watch));
}

export function clearWatch(roomCode: string) {
  localStorage.removeItem(watchStorageKey(roomCode));
}

export function loadPresence(): PresenceRecord | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PRESENCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PresenceRecord;
    if (!parsed.presenceId || !parsed.presenceToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePresence(record: PresenceRecord) {
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(record));
}

const OCCUPY_KEY = "tracinhos:occupy";

export function loadOccupy(): { roomCode: string; role: "seated" | "watching" } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OCCUPY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { roomCode?: string; role?: string };
    if (!parsed.roomCode) return null;
    if (parsed.role !== "seated" && parsed.role !== "watching") return null;
    return { roomCode: parsed.roomCode, role: parsed.role };
  } catch {
    return null;
  }
}

export function saveOccupy(roomCode: string, role: "seated" | "watching") {
  localStorage.setItem(OCCUPY_KEY, JSON.stringify({ roomCode, role }));
}

export function clearOccupy() {
  localStorage.removeItem(OCCUPY_KEY);
}
