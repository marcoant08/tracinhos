import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_SIZE,
  MAX_PLAYERS,
  applyMove,
  createGame,
  parseGrid,
  pickBotMove,
  pickRandomMove,
  type Edge,
  type GameState,
} from "@tracinhos/game";
import {
  BOT_THINK_MS,
  COLOR_IDS,
  DISCONNECT_TO_BOT_MS,
  LIVE_LIST_MAX,
  MAX_WATCHERS,
  PRESENCE_POLL_MS,
  PRESENCE_TTL_MS,
  ROOM_CODE_ALPHABET,
  ROOM_TTL_SECONDS,
  TURN_TIMEOUT_MS,
  WATCHER_TTL_MS,
  isColorId,
  isValidNick,
  nickKey,
  normalizeNick,
  pickBotColor,
  pickBotNick,
  type ColorId,
  type LiveRoom,
  type PlayerKind,
  type PublicRoom,
  type RoomStatus,
  type ServerMessage,
  type Session,
  type WatchSession,
} from "@tracinhos/shared";
import { RoomError } from "./errors";
import { getStore, loadJson, saveJson, withLock } from "./store";

export type Seat = {
  id: string;
  nick: string;
  color: ColorId;
  kind: PlayerKind;
  ownerPlayerId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
  seenAt: number;
  wsEpoch: number;
};

export type Watcher = {
  id: string;
  nick: string;
  color: ColorId;
  watchToken: string;
  seenAt: number;
};

export type Room = {
  code: string;
  cols: number;
  rows: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: Seat[];
  watchers: Watcher[];
  game: GameState | null;
  turnDeadlineAt: number | null;
  starterPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
};

export function toPublic(room: Room): PublicRoom {
  syncLocalPresence(room);
  return {
    code: room.code,
    cols: room.cols,
    rows: room.rows,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      color: p.color,
      kind: p.kind,
      connected: p.connected,
      ...(p.kind === "local" && p.ownerPlayerId ? { ownerPlayerId: p.ownerPlayerId } : {}),
    })),
    watchers: room.watchers.map((w) => ({
      id: w.id,
      nick: w.nick,
      color: w.color,
    })),
    takenNicks: allNicks(room).map(nickKey),
    takenColors: room.players.map((p) => p.color),
    game: room.game,
    turnDeadlineAt: room.status === "playing" ? (room.turnDeadlineAt ?? null) : null,
    starterPlayerId: room.starterPlayerId,
    updatedAt: room.updatedAt,
  };
}

export function toLiveRoom(room: Room | PublicRoom): LiveRoom {
  return {
    code: room.code,
    cols: room.cols,
    rows: room.rows,
    players: room.players.map((p) => ({
      nick: p.nick,
      color: p.color,
      squares: room.game?.scores[p.id] ?? 0,
    })),
    updatedAt: room.updatedAt,
  };
}

export async function getPublicRoom(
  code: string,
  seatToken?: string | null,
  watchToken?: string | null,
): Promise<PublicRoom> {
  let actorId: string | undefined;
  if (seatToken) {
    try {
      actorId = await actorFromToken(code, seatToken);
    } catch {
      actorId = undefined;
    }
  }
  const loaded = await mustRoom(code);
  const needsExpire = hasStaleRemote(loaded);
  const needsHeartbeat = Boolean(actorId && seatHeartbeatDue(loaded, actorId));
  const peek = sweep(loaded);
  const watchersRemoved = sweepWatchers(peek);
  const watcher = watchToken ? watcherFromToken(peek, watchToken) : null;
  const needsTouch = Boolean(actorId && seatNeedsTouch(peek, actorId));
  if (!needsTouch && !isTurnOverdue(peek) && !watchersRemoved && !needsExpire && !needsHeartbeat) {
    if (watcher) {
      watcher.seenAt = Date.now();
      await saveRoom(peek);
    }
    await ensureLiveIndex(peek);
    return toPublic(peek);
  }

  const result = await mutate(code, async (room) => {
    const reclaimed = actorId ? touchSeat(room, actorId) : false;
    if (reclaimed && currentSeat(room)?.id === actorId) {
      refreshTurnDeadline(room);
    }
    if (watchToken) {
      const live = watcherFromToken(room, watchToken);
      if (live) live.seenAt = Date.now();
    }
    const timedOut = advanceOverdueTurn(room);
    return { timedOut };
  });
  if (result.timedOut) publishTimeoutNotice(code, result.timedOut);
  armClocks(code, result.room);
  return result.room;
}

export async function createRoom(input: {
  size?: number;
  cols?: number;
  rows?: number;
  nick: string;
  color: string;
}): Promise<{ room: PublicRoom; session: Session }> {
  const cols = input.cols ?? input.size ?? DEFAULT_SIZE;
  const rows = input.rows ?? cols;
  let grid: { cols: number; rows: number };
  try {
    grid = parseGrid(cols, rows);
  } catch {
    throw new RoomError("invalid_size");
  }
  const nick = parseNick(input.nick);
  const color = parseColor(input.color);
  const code = await uniqueCode();
  const playerId = randomUUID();
  const seatToken = newToken();
  const room: Room = {
    code,
    cols: grid.cols,
    rows: grid.rows,
    status: "lobby",
    hostPlayerId: playerId,
    players: [
      {
        id: playerId,
        nick,
        color,
        kind: "remote",
        ownerPlayerId: null,
        connected: true,
        disconnectedAt: null,
        seenAt: Date.now(),
        wsEpoch: 1,
      },
    ],
    watchers: [],
    game: null,
    turnDeadlineAt: null,
    starterPlayerId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveRoom(room);
  await saveSeat(seatToken, code, playerId);
  return { room: toPublic(room), session: sessionOf(seatToken, room, playerId) };
}

export async function joinRoom(
  code: string,
  input: { nick: string; color: string },
): Promise<{ room: PublicRoom; session: Session; wsEpoch: number }> {
  const playerId = randomUUID();
  const seatToken = newToken();
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (room.players.length >= MAX_PLAYERS) throw new RoomError("room_full");
    const nick = parseNick(input.nick);
    const color = parseColor(input.color);
    assertIdentityFree(room, nick, color);
    room.players.push({
      id: playerId,
      nick,
      color,
      kind: "remote",
      ownerPlayerId: null,
      connected: true,
      disconnectedAt: null,
      seenAt: Date.now(),
      wsEpoch: 1,
    });
    await saveSeat(seatToken, room.code, playerId);
    return { seatToken, playerId, wsEpoch: 1 };
  });
  const player = result.room.players.find((p) => p.id === playerId)!;
  return {
    room: result.room,
    session: {
      playerId,
      seatToken,
      nick: player.nick,
      color: player.color,
      roomCode: result.room.code,
    },
    wsEpoch: result.wsEpoch,
  };
}

export async function resumeRoom(
  code: string,
  seatToken: string,
): Promise<{ room: PublicRoom; session: Session; wsEpoch: number }> {
  const seat = await loadSeat(seatToken);
  if (!seat || seat.roomCode !== normalizeCode(code)) {
    throw new RoomError("invalid_token");
  }
  const publicRoom = await mutate(code, async (room) => {
    const player = room.players.find((p) => p.id === seat.playerId);
    if (!player) throw new RoomError("invalid_token");
    player.kind = "remote";
    player.connected = true;
    player.disconnectedAt = null;
    player.seenAt = Date.now();
    player.wsEpoch = (player.wsEpoch ?? 0) + 1;
    return { playerId: player.id, wsEpoch: player.wsEpoch };
  });
  const player = publicRoom.room.players.find((p) => p.id === seat.playerId)!;
  return {
    room: publicRoom.room,
    session: {
      playerId: player.id,
      seatToken,
      nick: player.nick,
      color: player.color,
      roomCode: publicRoom.room.code,
    },
    wsEpoch: publicRoom.wsEpoch,
  };
}

export async function watchRoom(
  code: string,
  input: { nick: string; color: string },
): Promise<{ room: PublicRoom; watch: WatchSession }> {
  const watcherId = randomUUID();
  const watchToken = newToken();
  const result = await mutate(code, async (room) => {
    if (room.status !== "playing") throw new RoomError("not_playing");
    if (room.watchers.length >= MAX_WATCHERS) throw new RoomError("watchers_full");
    const nick = parseNick(input.nick);
    const color = parseColor(input.color);
    assertNickFree(room, nick);
    assertWatcherColorFree(room, color);
    room.watchers.push({
      id: watcherId,
      nick,
      color,
      watchToken,
      seenAt: Date.now(),
    });
    await saveWatchToken(watchToken, room.code, watcherId);
    return { nick, color };
  });
  return {
    room: result.room,
    watch: {
      watcherId,
      watchToken,
      nick: result.nick,
      color: result.color,
      roomCode: result.room.code,
    },
  };
}

export async function resumeWatch(
  code: string,
  watchToken: string,
): Promise<{ room: PublicRoom; watch: WatchSession }> {
  const rec = await loadWatchToken(watchToken);
  if (!rec || rec.roomCode !== normalizeCode(code)) {
    throw new RoomError("invalid_token");
  }
  const result = await mutate(code, async (room) => {
    if (room.status !== "playing") throw new RoomError("not_playing");
    const watcher = room.watchers.find((w) => w.id === rec.watcherId && w.watchToken === watchToken);
    if (!watcher) throw new RoomError("invalid_token");
    watcher.seenAt = Date.now();
    return { nick: watcher.nick, color: watcher.color, watcherId: watcher.id };
  });
  return {
    room: result.room,
    watch: {
      watcherId: result.watcherId,
      watchToken,
      nick: result.nick,
      color: result.color,
      roomCode: result.room.code,
    },
  };
}

export async function createSeatedRoom(input: {
  cols: number;
  rows: number;
  host: { nick: string; color: ColorId };
  guest: { nick: string; color: ColorId };
}): Promise<{ room: PublicRoom; hostSession: Session; guestSession: Session }> {
  let grid: { cols: number; rows: number };
  try {
    grid = parseGrid(input.cols, input.rows);
  } catch {
    throw new RoomError("invalid_size");
  }
  const hostNick = parseNick(input.host.nick);
  const guestNick = parseNick(input.guest.nick);
  if (nickKey(hostNick) === nickKey(guestNick)) throw new RoomError("nick_taken");
  const hostColor = parseColor(input.host.color);
  let guestColor = parseColor(input.guest.color);
  if (guestColor === hostColor) {
    const free = COLOR_IDS.find((id) => id !== hostColor);
    if (!free) throw new RoomError("color_taken");
    guestColor = free;
  }
  const code = await uniqueCode();
  const hostId = randomUUID();
  const guestId = randomUUID();
  const hostToken = newToken();
  const guestToken = newToken();
  const now = Date.now();
  const room: Room = {
    code,
    cols: grid.cols,
    rows: grid.rows,
    status: "lobby",
    hostPlayerId: hostId,
    players: [
      {
        id: hostId,
        nick: hostNick,
        color: hostColor,
        kind: "remote",
        ownerPlayerId: null,
        connected: true,
        disconnectedAt: null,
        seenAt: now,
        wsEpoch: 1,
      },
      {
        id: guestId,
        nick: guestNick,
        color: guestColor,
        kind: "remote",
        ownerPlayerId: null,
        connected: true,
        disconnectedAt: null,
        seenAt: now,
        wsEpoch: 1,
      },
    ],
    watchers: [],
    game: null,
    turnDeadlineAt: null,
    starterPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
  await saveRoom(room);
  await saveSeat(hostToken, code, hostId);
  await saveSeat(guestToken, code, guestId);
  return {
    room: toPublic(room),
    hostSession: sessionOf(hostToken, room, hostId),
    guestSession: sessionOf(guestToken, room, guestId),
  };
}

export async function listLiveRooms(): Promise<LiveRoom[]> {
  const codes = await loadLiveCodes();
  const rooms: LiveRoom[] = [];
  const keep: string[] = [];
  for (const code of codes) {
    try {
      const room = sweep(await mustRoom(code));
      if (room.status !== "playing") continue;
      keep.push(code);
      rooms.push(toLiveRoom(room));
    } catch {
      /* sala sumida */
    }
  }
  if (keep.length !== codes.length) {
    await saveJson(LIVE_INDEX_KEY, keep, ROOM_TTL_SECONDS);
  }
  rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  return rooms.slice(0, LIVE_LIST_MAX);
}

export async function addBot(code: string, actorId: string): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (room.hostPlayerId !== actorId) throw new RoomError("not_host");
    if (room.players.length >= MAX_PLAYERS) throw new RoomError("room_full");
    const color = pickBotColor(room.players.map((p) => p.color));
    if (!color) throw new RoomError("color_taken");
    const nick = pickBotNick(allNicks(room));
    room.players.push({
      id: randomUUID(),
      nick,
      color,
      kind: "bot",
      ownerPlayerId: null,
      connected: true,
      disconnectedAt: null,
      seenAt: Date.now(),
      wsEpoch: 0,
    });
    return {};
  });
  return result.room;
}

export async function addLocal(
  code: string,
  actorId: string,
  nickInput: string,
  colorInput: string,
): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    const actor = room.players.find((p) => p.id === actorId);
    if (!actor || actor.kind !== "remote") throw new RoomError("not_in_room");
    if (room.players.length >= MAX_PLAYERS) throw new RoomError("room_full");
    const nick = parseNick(nickInput);
    const color = parseColor(colorInput);
    assertIdentityFree(room, nick, color);
    room.players.push({
      id: randomUUID(),
      nick,
      color,
      kind: "local",
      ownerPlayerId: actorId,
      connected: actor.connected,
      disconnectedAt: null,
      seenAt: Date.now(),
      wsEpoch: 0,
    });
    return {};
  });
  return result.room;
}

export async function removePlayer(
  code: string,
  actorId: string,
  playerId: string,
): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (playerId === actorId || playerId === room.hostPlayerId) throw new RoomError("not_in_room");
    const index = room.players.findIndex((p) => p.id === playerId);
    if (index < 0) throw new RoomError("not_in_room");
    const target = room.players[index]!;
    const isHost = room.hostPlayerId === actorId;
    const ownsLocal = target.kind === "local" && target.ownerPlayerId === actorId;
    if (!isHost && !ownsLocal) throw new RoomError("not_host");
    room.players.splice(index, 1);
    if (room.starterPlayerId === playerId) room.starterPlayerId = null;
    await clearSeatForPlayer(room.code, playerId);
    return { kickedId: playerId };
  });
  return result.room;
}

export async function removeBot(code: string, actorId: string, playerId: string): Promise<PublicRoom> {
  return removePlayer(code, actorId, playerId);
}

export async function setStarter(
  code: string,
  actorId: string,
  playerId: string | null,
): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (room.hostPlayerId !== actorId) throw new RoomError("not_host");
    if (playerId !== null && !room.players.some((p) => p.id === playerId)) {
      throw new RoomError("not_in_room");
    }
    room.starterPlayerId = playerId;
    return {};
  });
  return result.room;
}

export async function startRoom(code: string, actorId: string): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (room.hostPlayerId !== actorId) throw new RoomError("not_host");
    if (room.players.length < 2) throw new RoomError("not_enough_players");
    room.status = "playing";
    const playerIds = room.players.map((p) => p.id);
    room.game = createGame(room.cols, playerIds, room.rows);
    const chosen =
      room.starterPlayerId && playerIds.includes(room.starterPlayerId)
        ? room.starterPlayerId
        : playerIds[Math.floor(Math.random() * playerIds.length)]!;
    room.game.currentPlayerIndex = room.game.playerIds.indexOf(chosen);
    refreshTurnDeadline(room);
    return {};
  });
  armClocks(code, result.room);
  return result.room;
}

export function parseDrawEdge(input: unknown): Edge {
  if (!input || typeof input !== "object") throw new RoomError("illegal_move");
  const edge = input as { orientation?: unknown; row?: unknown; col?: unknown };
  if (
    (edge.orientation !== "h" && edge.orientation !== "v") ||
    typeof edge.row !== "number" ||
    typeof edge.col !== "number" ||
    !Number.isInteger(edge.row) ||
    !Number.isInteger(edge.col)
  ) {
    throw new RoomError("illegal_move");
  }
  return { orientation: edge.orientation, row: edge.row, col: edge.col };
}

export async function drawEdge(
  code: string,
  actorId: string,
  edge: { orientation: "h" | "v"; row: number; col: number },
): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "playing" || !room.game) {
      throw new RoomError("illegal_move");
    }
    const reclaimed = touchSeat(room, actorId);
    if (reclaimed && currentSeat(room)?.id === actorId) {
      refreshTurnDeadline(room);
    }
    const timedOut = expireIfNeeded(room);
    if (timedOut) return { skipped: true, timedOut };
    const current = currentSeat(room);
    if (!current || !canPlayAs(actorId, current)) throw new RoomError("not_your_turn");
    try {
      room.game = applyMove(room.game, current.id, edge).state;
    } catch (error) {
      const codeName = (error as { code?: string }).code;
      if (codeName === "not_your_turn") throw new RoomError("not_your_turn");
      throw new RoomError("illegal_move");
    }
    if (room.game.status === "finished") room.status = "finished";
    refreshTurnDeadline(room);
    return { skipped: false, timedOut: null };
  });
  armClocks(code, result.room);
  if (result.timedOut) publishTimeoutNotice(code, result.timedOut);
  return result.room;
}

export async function markDisconnected(
  code: string,
  playerId: string,
  wsEpoch: number,
): Promise<PublicRoom | null> {
  try {
    const result = await mutate(code, async (room) => {
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.kind !== "remote") return {};
      if (player.wsEpoch !== wsEpoch) return {};
      markRemoteOffline(player);
      return {};
    });
    return result.room;
  } catch (error) {
    if (error instanceof RoomError && error.code === "room_not_found") return null;
    throw error;
  }
}

export async function markSeatOffline(code: string, playerId: string): Promise<PublicRoom | null> {
  try {
    const result = await mutate(code, async (room) => {
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.kind !== "remote" || !player.connected) return {};
      markRemoteOffline(player);
      return {};
    });
    return result.room;
  } catch (error) {
    if (error instanceof RoomError && error.code === "room_not_found") return null;
    throw error;
  }
}

export async function promoteDisconnectedToBot(
  code: string,
  playerId: string,
  wsEpoch: number,
): Promise<PublicRoom | null> {
  try {
    const room = await mustRoom(code);
    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.kind !== "remote" || player.connected || player.wsEpoch !== wsEpoch) {
      return toPublic(room);
    }
    const result = await mutate(code, async (next) => {
      const seat = next.players.find((p) => p.id === playerId);
      if (!seat || seat.kind !== "remote" || seat.connected || seat.wsEpoch !== wsEpoch) return {};
      seat.kind = "bot";
      convertOwnerLocalsToBots(next, playerId);
      refreshTurnDeadline(next);
      return {};
    });
    armClocks(code, result.room);
    return result.room;
  } catch (error) {
    if (error instanceof RoomError && error.code === "room_not_found") return null;
    throw error;
  }
}

export async function actorFromToken(
  code: string,
  seatToken: string,
): Promise<string> {
  const seat = await loadSeat(seatToken);
  if (!seat || seat.roomCode !== normalizeCode(code)) {
    throw new RoomError("invalid_token");
  }
  return seat.playerId;
}

async function mutate<T extends Record<string, unknown>>(
  code: string,
  fn: (room: Room) => T | Promise<T>,
): Promise<T & { room: PublicRoom }> {
  const store = getStore();
  const normalized = normalizeCode(code);
  const lockKey = `lock:room:${normalized}`;
  const lockToken = randomUUID();
  let locked = false;
  for (let i = 0; i < 25; i++) {
    locked = await store.setNxPx(lockKey, lockToken, 4000);
    if (locked) break;
    await sleep(40);
  }
  if (!locked) throw new Error("lock_timeout");
  let extra: T;
  let publicRoom: PublicRoom;
  let dirty = false;
  try {
    const room = await mustRoom(normalized);
    const before = JSON.stringify(room);
    sweep(room);
    extra = await fn(room);
    dirty = JSON.stringify(room) !== before;
    if (dirty) {
      room.updatedAt = Date.now();
      await saveRoom(room);
      await syncLiveIndex(room);
    }
    publicRoom = toPublic(room);
  } finally {
    await store.del(lockKey);
  }
  if (dirty) {
    try {
      await store.publish(
        `room:${normalized}`,
        JSON.stringify({
          type: publicRoom.status === "finished" ? "game:over" : "game:state",
          room: publicRoom,
        }),
      );
    } catch (error) {
      console.error(error);
    }
  }
  return { ...extra, room: publicRoom };
}

async function mustRoom(code: string): Promise<Room> {
  const raw = await getStore().get(roomKey(normalizeCode(code)));
  if (!raw) throw new RoomError("room_not_found");
  return hydrateRoom(JSON.parse(raw) as Room & { size?: number });
}

function hydrateRoom(room: Room & { size?: number }): Room {
  const withGrid =
    typeof room.cols === "number" && typeof room.rows === "number"
      ? room
      : {
          ...room,
          cols: typeof room.size === "number" ? room.size : DEFAULT_SIZE,
          rows: typeof room.size === "number" ? room.size : DEFAULT_SIZE,
        };
  return {
    ...withGrid,
    starterPlayerId: withGrid.starterPlayerId ?? null,
    watchers: Array.isArray(withGrid.watchers) ? withGrid.watchers : [],
    players: withGrid.players.map((p) => {
      const kind = normalizeKind(p.kind);
      return {
        ...p,
        kind,
        ownerPlayerId: kind === "local" ? p.ownerPlayerId ?? null : null,
        seenAt: typeof p.seenAt === "number" ? p.seenAt : Date.now(),
        wsEpoch: typeof p.wsEpoch === "number" ? p.wsEpoch : 0,
      };
    }),
  };
}

async function saveRoom(room: Room): Promise<void> {
  await getStore().set(roomKey(room.code), JSON.stringify(room), ROOM_TTL_SECONDS);
}

async function saveSeat(token: string, roomCode: string, playerId: string) {
  const store = getStore();
  const normalized = roomCode.toUpperCase();
  await store.set(`seat:${token}`, JSON.stringify({ roomCode: normalized, playerId }), ROOM_TTL_SECONDS);
  await store.set(`seat-player:${normalized}:${playerId}`, token, ROOM_TTL_SECONDS);
}

async function clearSeatForPlayer(roomCode: string, playerId: string) {
  const store = getStore();
  const normalized = roomCode.toUpperCase();
  const token = await store.get(`seat-player:${normalized}:${playerId}`);
  if (token) await store.del(`seat:${token}`);
  await store.del(`seat-player:${normalized}:${playerId}`);
}

async function loadSeat(token: string): Promise<{ roomCode: string; playerId: string } | null> {
  const raw = await getStore().get(`seat:${token}`);
  if (!raw) return null;
  return JSON.parse(raw) as { roomCode: string; playerId: string };
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    const exists = await getStore().get(roomKey(code));
    if (!exists) return code;
  }
  throw new Error("code_collision");
}

function randomCode(): string {
  let code = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function roomKey(code: string): string {
  return `room:${code}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseNick(nick: string): string {
  if (!isValidNick(nick)) throw new RoomError("invalid_nick");
  return normalizeNick(nick);
}

function parseColor(color: string): ColorId {
  if (!isColorId(color)) throw new RoomError("invalid_color");
  return color;
}

function assertIdentityFree(room: Room, nick: string, color: ColorId, exceptId?: string) {
  assertNickFree(room, nick, exceptId);
  for (const player of room.players) {
    if (player.id === exceptId) continue;
    if (player.color === color) throw new RoomError("color_taken");
  }
}

function assertNickFree(room: Room, nick: string, exceptId?: string) {
  for (const player of room.players) {
    if (player.id === exceptId) continue;
    if (nickKey(player.nick) === nickKey(nick)) throw new RoomError("nick_taken");
  }
  for (const watcher of room.watchers) {
    if (watcher.id === exceptId) continue;
    if (nickKey(watcher.nick) === nickKey(nick)) throw new RoomError("nick_taken");
  }
}

function assertWatcherColorFree(room: Room, color: ColorId, exceptId?: string) {
  for (const watcher of room.watchers) {
    if (watcher.id === exceptId) continue;
    if (watcher.color === color) throw new RoomError("color_taken");
  }
}

function allNicks(room: Room): string[] {
  return [...room.players.map((p) => p.nick), ...room.watchers.map((w) => w.nick)];
}

function watcherFromToken(room: Room, watchToken: string): Watcher | null {
  return room.watchers.find((w) => w.watchToken === watchToken) ?? null;
}

function sweepWatchers(room: Room): boolean {
  const now = Date.now();
  const next = room.watchers.filter((w) => now - w.seenAt < WATCHER_TTL_MS);
  if (next.length === room.watchers.length) return false;
  room.watchers = next;
  return true;
}

function markRemoteOffline(player: Seat) {
  player.connected = false;
  player.disconnectedAt = Date.now();
}

function seatSeenAt(player: Seat, fallback: number): number {
  return typeof player.seenAt === "number" ? player.seenAt : fallback;
}

function hasStaleRemote(room: Room): boolean {
  const now = Date.now();
  return room.players.some(
    (player) =>
      player.kind === "remote" &&
      player.connected &&
      now - seatSeenAt(player, now) >= PRESENCE_TTL_MS,
  );
}

function seatHeartbeatDue(room: Room, playerId: string): boolean {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.kind === "local") return false;
  return Date.now() - seatSeenAt(player, 0) >= PRESENCE_POLL_MS;
}

function expireStaleRemotes(room: Room): boolean {
  const now = Date.now();
  let changed = false;
  for (const player of room.players) {
    if (player.kind !== "remote" || !player.connected) continue;
    if (now - seatSeenAt(player, now) >= PRESENCE_TTL_MS) {
      markRemoteOffline(player);
      changed = true;
    }
  }
  return changed;
}

function sweep(room: Room): Room {
  const now = Date.now();
  expireStaleRemotes(room);
  const promoted: string[] = [];
  for (const player of room.players) {
    if (
      player.kind === "remote" &&
      !player.connected &&
      player.disconnectedAt &&
      now - player.disconnectedAt >= DISCONNECT_TO_BOT_MS
    ) {
      player.kind = "bot";
      promoted.push(player.id);
    }
  }
  for (const ownerId of promoted) convertOwnerLocalsToBots(room, ownerId);
  syncLocalPresence(room);
  sweepWatchers(room);
  return room;
}

const LIVE_INDEX_KEY = "live:rooms";

async function loadLiveCodes(): Promise<string[]> {
  const raw = await loadJson<unknown>(LIVE_INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((code): code is string => typeof code === "string" && code.length > 0);
}

async function ensureLiveIndex(room: Room) {
  if (room.status !== "playing" && room.status !== "finished") return;
  const codes = await loadLiveCodes();
  const has = codes.includes(room.code);
  if ((room.status === "playing") === has) return;
  await syncLiveIndex(room);
}

async function syncLiveIndex(room: Room) {
  try {
    await withLock("lock:live", async () => {
      const codes = await loadLiveCodes();
      const playing = room.status === "playing";
      const has = codes.includes(room.code);
      let next = codes;
      if (playing && !has) next = [room.code, ...codes];
      if (!playing && has) next = codes.filter((code) => code !== room.code);
      if (next !== codes) await saveJson(LIVE_INDEX_KEY, next, ROOM_TTL_SECONDS);
    });
  } catch (error) {
    console.error(error);
  }
}

async function saveWatchToken(token: string, roomCode: string, watcherId: string) {
  await getStore().set(
    `watch:${token}`,
    JSON.stringify({ roomCode, watcherId }),
    ROOM_TTL_SECONDS,
  );
}

async function loadWatchToken(token: string): Promise<{ roomCode: string; watcherId: string } | null> {
  const raw = await getStore().get(`watch:${token}`);
  if (!raw) return null;
  return JSON.parse(raw) as { roomCode: string; watcherId: string };
}

function seatNeedsTouch(room: Room, playerId: string): boolean {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.kind === "local") return false;
  return player.kind !== "remote" || !player.connected || player.disconnectedAt !== null;
}

function touchSeat(room: Room, playerId: string): boolean {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.kind === "local") return false;
  const changed = seatNeedsTouch(room, playerId);
  player.kind = "remote";
  player.connected = true;
  player.disconnectedAt = null;
  player.seenAt = Date.now();
  return changed;
}

const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
const turnSkipTimers = new Map<string, ReturnType<typeof setTimeout>>();
const skipGens = new Map<string, number>();

function normalizeKind(kind: string | undefined): PlayerKind {
  if (kind === "local" || kind === "bot" || kind === "remote") return kind;
  return "remote";
}

function isTimedHuman(kind: PlayerKind): boolean {
  return kind === "remote" || kind === "local";
}

function canPlayAs(actorId: string, current: Seat): boolean {
  return current.id === actorId || (current.kind === "local" && current.ownerPlayerId === actorId);
}

function convertOwnerLocalsToBots(room: Room, ownerId: string) {
  for (const player of room.players) {
    if (player.kind === "local" && player.ownerPlayerId === ownerId) {
      player.kind = "bot";
      player.ownerPlayerId = null;
    }
  }
}

function syncLocalPresence(room: Room) {
  for (const player of room.players) {
    if (player.kind !== "local") continue;
    const owner = room.players.find((p) => p.id === player.ownerPlayerId);
    player.connected = Boolean(owner && owner.kind === "remote" && owner.connected);
  }
}

function currentSeat(room: Room): Seat | null {
  if (room.status !== "playing" || !room.game || room.game.status !== "playing") {
    return null;
  }
  const id = room.game.playerIds[room.game.currentPlayerIndex] ?? "";
  return room.players.find((p) => p.id === id) ?? null;
}

function refreshTurnDeadline(room: Room) {
  const seat = currentSeat(room);
  if (seat && isTimedHuman(seat.kind)) {
    room.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
  } else if (seat?.kind === "bot") {
    room.turnDeadlineAt = Date.now() + BOT_THINK_MS;
  } else {
    room.turnDeadlineAt = null;
  }
}

function isTurnOverdue(room: Room): boolean {
  return (
    room.status === "playing" &&
    room.game?.status === "playing" &&
    typeof room.turnDeadlineAt === "number" &&
    Date.now() >= room.turnDeadlineAt
  );
}

function playDueBotMove(room: Room): boolean {
  if (!isTurnOverdue(room) || !room.game) return false;
  const seat = currentSeat(room);
  if (!seat || seat.kind !== "bot") return false;
  room.game = applyMove(room.game, seat.id, pickBotMove(room.game, Math.random)).state;
  if (room.game.status === "finished") room.status = "finished";
  refreshTurnDeadline(room);
  return true;
}

function advanceOverdueTurn(room: Room): { playerId: string; nick: string } | null {
  const timedOut = expireIfNeeded(room);
  if (timedOut) return timedOut;
  playDueBotMove(room);
  return null;
}

function expireIfNeeded(room: Room): { playerId: string; nick: string } | null {
  if (!room.turnDeadlineAt || Date.now() < room.turnDeadlineAt) return null;
  const seat = currentSeat(room);
  if (!seat || !isTimedHuman(seat.kind) || !room.game) return null;
  room.game = applyMove(room.game, seat.id, pickRandomMove(room.game, Math.random)).state;
  if (room.game.status === "finished") room.status = "finished";
  refreshTurnDeadline(room);
  return { playerId: seat.id, nick: seat.nick };
}

function publishTimeoutNotice(code: string, timedOut: { playerId: string; nick: string }) {
  const message: ServerMessage = {
    type: "game:notice",
    notice: "timeout_draw",
    playerId: timedOut.playerId,
    nick: timedOut.nick,
  };
  void getStore()
    .publish(`room:${normalizeCode(code)}`, JSON.stringify(message))
    .catch((error) => {
      console.error(error);
    });
}

function clearTurnSkip(code: string) {
  const timer = turnSkipTimers.get(code);
  if (timer) clearTimeout(timer);
  turnSkipTimers.delete(code);
}

function clearBotTimer(code: string) {
  const timer = botTimers.get(code);
  if (timer) clearTimeout(timer);
  botTimers.delete(code);
}

function armClocks(code: string, room: PublicRoom) {
  const normalized = normalizeCode(code);
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  if (room.status === "playing" && room.game?.status === "playing" && current?.kind === "bot") {
    const wait = room.turnDeadlineAt
      ? Math.max(0, room.turnDeadlineAt - Date.now())
      : BOT_THINK_MS;
    queueBotTurns(normalized, wait);
  } else {
    clearBotTimer(normalized);
  }
  scheduleTurnSkip(normalized, room);
}

function scheduleTurnSkip(code: string, room: PublicRoom) {
  clearTurnSkip(code);
  const gen = (skipGens.get(code) ?? 0) + 1;
  skipGens.set(code, gen);
  if (!room.turnDeadlineAt || room.status !== "playing") return;
  const currentId = room.game?.playerIds[room.game.currentPlayerIndex];
  const current = room.players.find((p) => p.id === currentId);
  if (!current || !isTimedHuman(current.kind)) return;
  const wait = Math.max(0, room.turnDeadlineAt - Date.now());
  turnSkipTimers.set(
    code,
    setTimeout(() => {
      if (skipGens.get(code) !== gen) return;
      turnSkipTimers.delete(code);
      void expireTurn(code);
    }, wait),
  );
}

async function expireTurn(code: string): Promise<void> {
  try {
    const result = await mutate(code, async (room) => {
      const timedOut = expireIfNeeded(room);
      return { timedOut };
    });
    if (result.timedOut) publishTimeoutNotice(code, result.timedOut);
    armClocks(code, result.room);
  } catch (error) {
    if (error instanceof RoomError && error.code === "room_not_found") return;
    console.error(error);
  }
}

export function queueBotTurns(code: string, waitMs = BOT_THINK_MS) {
  const normalized = normalizeCode(code);
  clearBotTimer(normalized);
  botTimers.set(
    normalized,
    setTimeout(() => {
      botTimers.delete(normalized);
      void playOneBotMove(normalized);
    }, waitMs),
  );
}

async function playOneBotMove(code: string): Promise<void> {
  try {
    const peek = await mustRoom(code);
    if (peek.status !== "playing" || !peek.game || peek.game.status !== "playing") return;
    const currentId = peek.game.playerIds[peek.game.currentPlayerIndex] ?? "";
    const current = peek.players.find((p) => p.id === currentId);
    if (!current || current.kind !== "bot") return;

    const result = await mutate(code, async (room) => {
      if (room.status !== "playing" || !room.game || room.game.status !== "playing") {
        return { again: false };
      }
      const id = room.game.playerIds[room.game.currentPlayerIndex] ?? "";
      const player = room.players.find((p) => p.id === id);
      if (!player || player.kind !== "bot") return { again: false };
      if (room.turnDeadlineAt && Date.now() < room.turnDeadlineAt) return { again: false };
      room.game = applyMove(room.game, player.id, pickBotMove(room.game, Math.random)).state;
      if (room.game.status === "finished") room.status = "finished";
      refreshTurnDeadline(room);
      const nextId = room.game.playerIds[room.game.currentPlayerIndex] ?? "";
      const next = room.players.find((p) => p.id === nextId);
      return { again: room.game.status === "playing" && next?.kind === "bot" };
    });
    armClocks(code, result.room);
  } catch (error) {
    if (error instanceof RoomError && error.code === "room_not_found") return;
    console.error(error);
  }
}

function sessionOf(seatToken: string, room: Room, playerId: string): Session {
  const player = room.players.find((p) => p.id === playerId)!;
  return {
    playerId,
    seatToken,
    nick: player.nick,
    color: player.color,
    roomCode: room.code,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
