import {
  IDENTITY_KEY,
  isColorId,
  isValidNick,
  sessionStorageKey,
  type ColorId,
  type Session,
} from "@tracinhos/shared";

export type IdentityPref = { nick: string; color: ColorId };

export function loadIdentity(): IdentityPref | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(IDENTITY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { nick?: unknown; color?: unknown };
    if (typeof parsed.nick !== "string" || !isValidNick(parsed.nick) || !isColorId(String(parsed.color ?? ""))) {
      return null;
    }
    return { nick: parsed.nick, color: parsed.color as ColorId };
  } catch {
    return null;
  }
}

export function saveIdentity(pref: IdentityPref) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(pref));
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
