import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_SIZE,
  MAX_PLAYERS,
  applyMove,
  createGame,
  parseGrid,
  pickBotMove,
  pickRandomMove,
  type GameState,
} from "@tracinhos/game";
import {
  BOT_THINK_MS,
  COLOR_IDS,
  DISCONNECT_TO_BOT_MS,
  ROOM_CODE_ALPHABET,
  ROOM_TTL_SECONDS,
  TURN_TIMEOUT_MS,
  isColorId,
  isValidNick,
  nickKey,
  normalizeNick,
  pickBotNick,
  type ColorId,
  type PlayerKind,
  type PublicRoom,
  type RoomStatus,
  type ServerMessage,
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
  cols: number;
  rows: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: Seat[];
  game: GameState | null;
  turnDeadlineAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export function toPublic(room: Room): PublicRoom {
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
    })),
    takenNicks: room.players.map((p) => nickKey(p.nick)),
    takenColors: room.players.map((p) => p.color),
    game: room.game,
    turnDeadlineAt: room.status === "playing" ? (room.turnDeadlineAt ?? null) : null,
    updatedAt: room.updatedAt,
  };
}

export async function getPublicRoom(code: string): Promise<PublicRoom> {
  const room = await mustRoom(code);
  return toPublic(sweep(room));
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
        kind: "human",
        connected: true,
        disconnectedAt: null,
      },
    ],
    game: null,
    turnDeadlineAt: null,
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
    const nick = pickBotNick(room.players.map((p) => p.nick));
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
      room.cols,
      room.players.map((p) => p.id),
      room.rows,
    );
    refreshTurnDeadline(room);
    return {};
  });
  armClocks(code, result.room);
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
    const timedOut = expireIfNeeded(room);
    if (timedOut) return { skipped: true, timedOut };
    try {
      room.game = applyMove(room.game, actorId, edge).state;
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
  if (typeof room.cols === "number" && typeof room.rows === "number") return room;
  const side = typeof room.size === "number" ? room.size : DEFAULT_SIZE;
  return { ...room, cols: side, rows: side };
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

const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
const turnSkipTimers = new Map<string, ReturnType<typeof setTimeout>>();
const skipGens = new Map<string, number>();

function currentSeat(room: Room): Seat | null {
  if (room.status !== "playing" || !room.game || room.game.status !== "playing") {
    return null;
  }
  const id = room.game.playerIds[room.game.currentPlayerIndex] ?? "";
  return room.players.find((p) => p.id === id) ?? null;
}

function refreshTurnDeadline(room: Room) {
  const seat = currentSeat(room);
  if (seat?.kind === "human") {
    room.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
  } else if (seat?.kind === "bot") {
    room.turnDeadlineAt = Date.now() + BOT_THINK_MS;
  } else {
    room.turnDeadlineAt = null;
  }
}

function expireIfNeeded(room: Room): { playerId: string; nick: string } | null {
  if (!room.turnDeadlineAt || Date.now() < room.turnDeadlineAt) return null;
  const seat = currentSeat(room);
  if (!seat || seat.kind !== "human" || !room.game) return null;
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
    queueBotTurns(normalized, BOT_THINK_MS);
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
  if (current?.kind !== "human") return;
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
