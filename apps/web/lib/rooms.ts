import { randomBytes, randomUUID } from "node:crypto";
import {
  MAX_PLAYERS,
  MAX_SIZE,
  MIN_SIZE,
  applyMove,
  createGame,
  pickBotMove,
  type GameState,
} from "@tracinhos/game";
import {
  COLOR_IDS,
  DISCONNECT_TO_BOT_MS,
  ROOM_CODE_ALPHABET,
  ROOM_TTL_SECONDS,
  isColorId,
  isValidNick,
  nickKey,
  normalizeNick,
  type ColorId,
  type PlayerKind,
  type PublicRoom,
  type RoomStatus,
  type Session,
} from "@tracinhos/shared";
import { RoomError } from "./errors";
import { getStore } from "./store";

export type Seat = {
  id: string;
  nick: string;
  color: ColorId;
  kind: PlayerKind;
  connected: boolean;
  disconnectedAt: number | null;
};

export type Room = {
  code: string;
  size: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: Seat[];
  game: GameState | null;
  createdAt: number;
  updatedAt: number;
};

export function toPublic(room: Room): PublicRoom {
  return {
    code: room.code,
    size: room.size,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      color: p.color,
      kind: p.kind,
      connected: p.connected,
    })),
    takenNicks: room.players.map((p) => nickKey(p.nick)),
    takenColors: room.players.map((p) => p.color),
    game: room.game,
  };
}

export async function getPublicRoom(code: string): Promise<PublicRoom> {
  const room = await mustRoom(code);
  return toPublic(sweep(room));
}

export async function createRoom(input: {
  size?: number;
  nick: string;
  color: string;
}): Promise<{ room: PublicRoom; session: Session }> {
  const size = input.size ?? 5;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RoomError("invalid_size");
  }
  const nick = parseNick(input.nick);
  const color = parseColor(input.color);
  const code = await uniqueCode();
  const playerId = randomUUID();
  const seatToken = newToken();
  const room: Room = {
    code,
    size,
    status: "lobby",
    hostPlayerId: playerId,
    players: [
      {
        id: playerId,
        nick,
        color,
        kind: "human",
        connected: true,
        disconnectedAt: null,
      },
    ],
    game: null,
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
): Promise<{ room: PublicRoom; session: Session }> {
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
      kind: "human",
      connected: true,
      disconnectedAt: null,
    });
    await saveSeat(seatToken, room.code, playerId);
    return { seatToken, playerId };
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
  };
}

export async function resumeRoom(
  code: string,
  seatToken: string,
): Promise<{ room: PublicRoom; session: Session }> {
  const seat = await loadSeat(seatToken);
  if (!seat || seat.roomCode !== normalizeCode(code)) {
    throw new RoomError("invalid_token");
  }
  const publicRoom = await mutate(code, async (room) => {
    const player = room.players.find((p) => p.id === seat.playerId);
    if (!player) throw new RoomError("invalid_token");
    player.kind = "human";
    player.connected = true;
    player.disconnectedAt = null;
    return { playerId: player.id };
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
  };
}

export async function addBot(code: string, actorId: string): Promise<PublicRoom> {
  const result = await mutate(code, async (room) => {
    if (room.status !== "lobby") throw new RoomError("game_already_started");
    if (room.hostPlayerId !== actorId) throw new RoomError("not_host");
    if (room.players.length >= MAX_PLAYERS) throw new RoomError("room_full");
    const color = COLOR_IDS.find((id) => !room.players.some((p) => p.color === id));
    if (!color) throw new RoomError("color_taken");
    let n = 1;
    let nick = `Bot ${n}`;
    while (room.players.some((p) => nickKey(p.nick) === nickKey(nick))) {
      n += 1;
      nick = `Bot ${n}`;
    }
    room.players.push({
      id: randomUUID(),
      nick,
      color,
      kind: "bot",
      connected: true,
      disconnectedAt: null,
    });
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
    room.game = createGame(
      room.size,
      room.players.map((p) => p.id),
    );
    return {};
  });
  queueBotTurns(code);
  return result.room;
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
    try {
      room.game = applyMove(room.game, actorId, edge).state;
    } catch (error) {
      const codeName = (error as { code?: string }).code;
      if (codeName === "not_your_turn") throw new RoomError("not_your_turn");
      throw new RoomError("illegal_move");
    }
    if (room.game.status === "finished") room.status = "finished";
    return {};
  });
  queueBotTurns(code);
  return result.room;
}

export async function markDisconnected(code: string, playerId: string): Promise<PublicRoom | null> {
  try {
    const result = await mutate(code, async (room) => {
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.kind === "bot") return {};
      player.connected = false;
      player.disconnectedAt = Date.now();
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
): Promise<PublicRoom | null> {
  try {
    const room = await mustRoom(code);
    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.kind === "bot" || player.connected) return toPublic(room);
    const result = await mutate(code, async (next) => {
      const seat = next.players.find((p) => p.id === playerId);
      if (!seat || seat.kind === "bot" || seat.connected) return {};
      seat.kind = "bot";
      return {};
    });
    queueBotTurns(code);
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
    }
    publicRoom = toPublic(room);
  } finally {
    await store.del(lockKey);
  }
  if (dirty) {
    void store
      .publish(
        `room:${normalized}`,
        JSON.stringify({
          type: publicRoom.status === "finished" ? "game:over" : "game:state",
          room: publicRoom,
        }),
      )
      .catch((error) => {
        console.error(error);
      });
  }
  return { ...extra, room: publicRoom };
}

async function mustRoom(code: string): Promise<Room> {
  const raw = await getStore().get(roomKey(normalizeCode(code)));
  if (!raw) throw new RoomError("room_not_found");
  return JSON.parse(raw) as Room;
}

async function saveRoom(room: Room): Promise<void> {
  await getStore().set(roomKey(room.code), JSON.stringify(room), ROOM_TTL_SECONDS);
}

async function saveSeat(token: string, roomCode: string, playerId: string) {
  await getStore().set(
    `seat:${token}`,
    JSON.stringify({ roomCode, playerId }),
    ROOM_TTL_SECONDS,
  );
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
  for (const player of room.players) {
    if (player.id === exceptId) continue;
    if (nickKey(player.nick) === nickKey(nick)) throw new RoomError("nick_taken");
    if (player.color === color) throw new RoomError("color_taken");
  }
}

function sweep(room: Room): Room {
  const now = Date.now();
  for (const player of room.players) {
    if (
      player.kind === "human" &&
      !player.connected &&
      player.disconnectedAt &&
      now - player.disconnectedAt >= DISCONNECT_TO_BOT_MS
    ) {
      player.kind = "bot";
    }
  }
  return room;
}

const BOT_TURN_MS = 750;
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function queueBotTurns(code: string) {
  const normalized = normalizeCode(code);
  if (botTimers.has(normalized)) return;
  botTimers.set(
    normalized,
    setTimeout(() => {
      botTimers.delete(normalized);
      void playOneBotMove(normalized);
    }, BOT_TURN_MS),
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
      room.game = applyMove(room.game, player.id, pickBotMove(room.game, Math.random)).state;
      if (room.game.status === "finished") room.status = "finished";
      const nextId = room.game.playerIds[room.game.currentPlayerIndex] ?? "";
      const next = room.players.find((p) => p.id === nextId);
      return { again: room.game.status === "playing" && next?.kind === "bot" };
    });
    if (result.again) queueBotTurns(code);
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
