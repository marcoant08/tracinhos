import { sessionStorageKey, type Session } from "@tracinhos/shared";

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
