import type { ColorId, LobbySnapshot } from "@tracinhos/shared";
import { loadPresence, savePresence } from "./session";

export async function fetchLobby(presenceToken?: string): Promise<LobbySnapshot | null> {
  const headers: Record<string, string> = {};
  if (presenceToken) headers["x-presence-token"] = presenceToken;
  let res = await fetch("/api/lobby", { cache: "no-store", headers });
  if (!res.ok && presenceToken) {
    res = await fetch("/api/lobby", { cache: "no-store" });
  }
  if (!res.ok) return null;
  return (await res.json()) as LobbySnapshot;
}

export async function heartbeatPresence(input: {
  nick: string;
  color: ColorId;
  cols?: number;
  rows?: number;
  occupying?: { roomCode: string; role: "seated" | "watching" } | null;
}): Promise<{ presenceId: string; presenceToken: string } | null> {
  const body = {
    nick: input.nick,
    color: input.color,
    cols: input.cols,
    rows: input.rows,
    occupying: input.occupying ?? null,
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

export function leavePresenceNow(seated?: { roomCode: string; seatToken: string } | null) {
  const token = loadPresence()?.presenceToken;
  if (!token && !seated?.seatToken) return;
  const body = JSON.stringify({
    presenceToken: token ?? "",
    roomCode: seated?.roomCode ?? "",
    seatToken: seated?.seatToken ?? "",
  });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/presence/leave", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/presence/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
