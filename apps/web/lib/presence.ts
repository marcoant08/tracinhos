import { randomBytes, randomUUID } from "node:crypto";
import {
  CHALLENGE_TTL_MS,
  PRESENCE_TTL_MS,
  ROOM_TTL_SECONDS,
  isColorId,
  isValidNick,
  normalizeNick,
  type ColorId,
  type LobbySnapshot,
  type PresenceRecord,
  type PresenceStatus,
  type PublicPresence,
  type PublicRoom,
  type Session,
} from "@tracinhos/shared";
import { RoomError } from "./errors";
import { createSeatedRoom, listLiveRooms } from "./rooms";
import { loadJson, saveJson, withLock } from "./store";

const PRESENCE_TTL_SECONDS = Math.ceil(PRESENCE_TTL_MS / 1000) + 5;
const INDEX_KEY = "presence:index";

type Occupying = {
  roomCode: string;
  role: "seated" | "watching";
};

type Presence = {
  presenceId: string;
  presenceToken: string;
  nick: string;
  color: ColorId;
  cols: number;
  rows: number;
  status: PresenceStatus;
  roomCode: string | null;
  seenAt: number;
  pendingChallengeId: string | null;
  accepted: { roomCode: string; session: Session } | null;
};

type Challenge = {
  id: string;
  fromId: string;
  toId: string;
  cols: number;
  rows: number;
  status: "pending" | "accepted" | "declined" | "expired";
  roomCode: string | null;
  createdAt: number;
  expiresAt: number;
};

export async function pingPresence(input: {
  presenceToken: string;
  nick: string;
  color: string;
  cols?: number;
  rows?: number;
  occupying?: Occupying | null;
}): Promise<{ presence: PresenceRecord }> {
  const now = Date.now();
  const token = input.presenceToken.trim();
  let presence: Presence | null = null;
  if (token) {
    presence = await loadPresenceByToken(token);
    if (!presence) throw new RoomError("invalid_token");
  } else {
    presence = {
      presenceId: randomUUID(),
      presenceToken: newToken(),
      nick: "",
      color: "blue",
      cols: 5,
      rows: 5,
      status: "idle",
      roomCode: null,
      seenAt: now,
      pendingChallengeId: null,
      accepted: null,
    };
  }

  const nick = isValidNick(input.nick) ? normalizeNick(input.nick) : "";
  const color = isColorId(input.color) ? input.color : presence.color;
  presence.nick = nick;
  presence.color = color;
  if (typeof input.cols === "number" && Number.isFinite(input.cols)) presence.cols = input.cols;
  if (typeof input.rows === "number" && Number.isFinite(input.rows)) presence.rows = input.rows;
  presence.seenAt = now;
  if (input.occupying?.role === "seated" || input.occupying?.role === "watching") {
    presence.status = input.occupying.role;
    presence.roomCode = input.occupying.roomCode;
  } else {
    presence.status = "idle";
    presence.roomCode = null;
  }
  await savePresence(presence);
  await addToIndex(presence.presenceId);
  return {
    presence: { presenceId: presence.presenceId, presenceToken: presence.presenceToken },
  };
}

export async function getLobby(presenceToken?: string | null): Promise<LobbySnapshot> {
  let me: Presence | null = null;
  if (presenceToken) {
    me = await loadPresenceByToken(presenceToken);
  }

  const accepted = me?.accepted ?? null;
  if (me && me.accepted) {
    me.accepted = null;
    await savePresence(me);
  }

  const inbox = me ? await pendingFor(me, "to") : null;
  const outgoing = me ? await pendingFor(me, "from") : null;

  return {
    online: await listOnline(me?.presenceId),
    live: await listLiveRooms(),
    inbox: inbox
      ? {
          id: inbox.challenge.id,
          from: publicOf(inbox.peer),
          cols: inbox.challenge.cols,
          rows: inbox.challenge.rows,
          expiresAt: inbox.challenge.expiresAt,
        }
      : null,
    outgoing: outgoing
      ? {
          id: outgoing.challenge.id,
          to: publicOf(outgoing.peer),
          expiresAt: outgoing.challenge.expiresAt,
        }
      : null,
    accepted,
  };
}

export async function createChallenge(
  presenceToken: string,
  toPresenceId: string,
): Promise<{ challenge: { id: string; expiresAt: number } }> {
  const from = await loadPresenceByToken(presenceToken);
  if (!from) throw new RoomError("invalid_token");
  if (from.presenceId === toPresenceId) throw new RoomError("challenge_self");
  if (!isValidNick(from.nick)) throw new RoomError("invalid_nick");

  return withLock("lock:challenges", async () => {
    const freshFrom = (await loadPresence(from.presenceId)) ?? from;
    const to = await loadPresence(toPresenceId);
    if (!to || !isFresh(to) || !isValidNick(to.nick)) throw new RoomError("challenge_gone");
    if (freshFrom.status !== "idle" || to.status !== "idle") throw new RoomError("challenge_busy");
    await expireIfNeeded(freshFrom);
    await expireIfNeeded(to);
    const fromAgain = (await loadPresence(freshFrom.presenceId)) ?? freshFrom;
    const toAgain = (await loadPresence(to.presenceId)) ?? to;
    if (fromAgain.pendingChallengeId || toAgain.pendingChallengeId) {
      throw new RoomError("challenge_pending");
    }

    const now = Date.now();
    const challenge: Challenge = {
      id: randomUUID(),
      fromId: fromAgain.presenceId,
      toId: toAgain.presenceId,
      cols: fromAgain.cols,
      rows: fromAgain.rows,
      status: "pending",
      roomCode: null,
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
    };
    fromAgain.pendingChallengeId = challenge.id;
    toAgain.pendingChallengeId = challenge.id;
    await saveChallenge(challenge);
    await savePresence(fromAgain);
    await savePresence(toAgain);
    return { challenge: { id: challenge.id, expiresAt: challenge.expiresAt } };
  });
}

export async function acceptChallenge(
  presenceToken: string,
  challengeId: string,
): Promise<{ room: PublicRoom; session: Session }> {
  const to = await loadPresenceByToken(presenceToken);
  if (!to) throw new RoomError("invalid_token");

  return withLock("lock:challenges", async () => {
    const challenge = await loadChallenge(challengeId);
    if (!challenge || challenge.toId !== to.presenceId) throw new RoomError("challenge_gone");
    await expireChallenge(challenge);
    if (challenge.status !== "pending") throw new RoomError("challenge_gone");

    const from = await loadPresence(challenge.fromId);
    const freshTo = (await loadPresence(to.presenceId)) ?? to;
    if (!from || !isFresh(from) || !isValidNick(from.nick) || !isValidNick(freshTo.nick)) {
      throw new RoomError("challenge_gone");
    }
    if (from.status !== "idle" || freshTo.status !== "idle") throw new RoomError("challenge_busy");

    const created = await createSeatedRoom({
      cols: challenge.cols,
      rows: challenge.rows,
      host: { nick: from.nick, color: from.color },
      guest: { nick: freshTo.nick, color: freshTo.color },
    });

    challenge.status = "accepted";
    challenge.roomCode = created.room.code;
    from.status = "seated";
    from.roomCode = created.room.code;
    from.pendingChallengeId = null;
    from.accepted = { roomCode: created.room.code, session: created.hostSession };
    freshTo.status = "seated";
    freshTo.roomCode = created.room.code;
    freshTo.pendingChallengeId = null;
    await saveChallenge(challenge);
    await savePresence(from);
    await savePresence(freshTo);
    return { room: created.room, session: created.guestSession };
  });
}

export async function declineChallenge(presenceToken: string, challengeId: string): Promise<{ ok: true }> {
  const to = await loadPresenceByToken(presenceToken);
  if (!to) throw new RoomError("invalid_token");

  return withLock("lock:challenges", async () => {
    const challenge = await loadChallenge(challengeId);
    if (!challenge || challenge.toId !== to.presenceId) throw new RoomError("challenge_gone");
    await expireChallenge(challenge);
    if (challenge.status !== "pending") throw new RoomError("challenge_gone");
    challenge.status = "declined";
    await saveChallenge(challenge);
    await clearPending(challenge.fromId, challenge.id);
    await clearPending(challenge.toId, challenge.id);
    return { ok: true as const };
  });
}

async function listOnline(exceptId?: string): Promise<PublicPresence[]> {
  const ids = (await loadJson<string[]>(INDEX_KEY)) ?? [];
  const online: PublicPresence[] = [];
  const keep: string[] = [];
  for (const id of ids) {
    const presence = await loadPresence(id);
    if (!presence) continue;
    keep.push(id);
    if (exceptId && presence.presenceId === exceptId) continue;
    if (!isFresh(presence) || presence.status !== "idle" || !isValidNick(presence.nick)) continue;
    online.push(publicOf(presence));
  }
  if (keep.length !== ids.length) await saveJson(INDEX_KEY, keep, ROOM_TTL_SECONDS);
  return online;
}

async function pendingFor(
  me: Presence,
  side: "from" | "to",
): Promise<{ challenge: Challenge; peer: Presence } | null> {
  if (!me.pendingChallengeId) return null;
  const challenge = await loadChallenge(me.pendingChallengeId);
  if (!challenge) {
    me.pendingChallengeId = null;
    await savePresence(me);
    return null;
  }
  await expireChallenge(challenge);
  if (challenge.status !== "pending") {
    if (me.pendingChallengeId === challenge.id) {
      me.pendingChallengeId = null;
      await savePresence(me);
    }
    return null;
  }
  const mine = side === "from" ? challenge.fromId : challenge.toId;
  if (mine !== me.presenceId) return null;
  const peerId = side === "from" ? challenge.toId : challenge.fromId;
  const peer = await loadPresence(peerId);
  if (!peer) return null;
  return { challenge, peer };
}

async function expireIfNeeded(presence: Presence) {
  if (!presence.pendingChallengeId) return;
  const challenge = await loadChallenge(presence.pendingChallengeId);
  if (challenge) await expireChallenge(challenge);
}

async function expireChallenge(challenge: Challenge) {
  if (challenge.status !== "pending") return;
  if (Date.now() < challenge.expiresAt) return;
  challenge.status = "expired";
  await saveChallenge(challenge);
  await clearPending(challenge.fromId, challenge.id);
  await clearPending(challenge.toId, challenge.id);
}

async function clearPending(presenceId: string, challengeId: string) {
  const presence = await loadPresence(presenceId);
  if (!presence || presence.pendingChallengeId !== challengeId) return;
  presence.pendingChallengeId = null;
  await savePresence(presence);
}

function isFresh(presence: Presence) {
  return Date.now() - presence.seenAt < PRESENCE_TTL_MS;
}

function publicOf(presence: Presence): PublicPresence {
  return { presenceId: presence.presenceId, nick: presence.nick, color: presence.color };
}

async function addToIndex(id: string) {
  await withLock("lock:presence-index", async () => {
    const ids = (await loadJson<string[]>(INDEX_KEY)) ?? [];
    if (ids.includes(id)) return;
    await saveJson(INDEX_KEY, [...ids, id], ROOM_TTL_SECONDS);
  });
}

async function loadPresence(id: string): Promise<Presence | null> {
  return loadJson<Presence>(`presence:${id}`);
}

async function loadPresenceByToken(token: string): Promise<Presence | null> {
  const rec = await loadJson<{ presenceId: string }>(`presence-token:${token}`);
  if (!rec) return null;
  const presence = await loadPresence(rec.presenceId);
  if (!presence || presence.presenceToken !== token) return null;
  return presence;
}

async function savePresence(presence: Presence) {
  await saveJson(`presence:${presence.presenceId}`, presence, PRESENCE_TTL_SECONDS);
  await saveJson(
    `presence-token:${presence.presenceToken}`,
    { presenceId: presence.presenceId },
    PRESENCE_TTL_SECONDS,
  );
}

async function loadChallenge(id: string): Promise<Challenge | null> {
  return loadJson<Challenge>(`challenge:${id}`);
}

async function saveChallenge(challenge: Challenge) {
  await saveJson(`challenge:${challenge.id}`, challenge, Math.ceil(CHALLENGE_TTL_MS / 1000) + 60);
}

function newToken() {
  return randomBytes(24).toString("base64url");
}
