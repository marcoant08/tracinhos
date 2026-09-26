import {
  ERROR_MESSAGES,
  DISCONNECT_TO_BOT_MS,
  isColorId,
  type ClientMessage,
  type ServerMessage,
} from "@tracinhos/shared";
import { RoomError } from "./errors";
import {
  addBot,
  addLocal,
  drawEdge,
  removeBot,
  joinRoom,
  markDisconnected,
  promoteDisconnectedToBot,
  resumeRoom,
  setStarter,
  startRoom,
} from "./rooms";
import { getStore } from "./store";

export type SocketLike = {
  send: (data: string) => void;
  close: () => void;
  on: (event: "message" | "close", listener: (...args: unknown[]) => void) => void;
};

type Binding = {
  socket: SocketLike;
  roomCode: string;
  playerId: string;
  seatToken: string;
  wsEpoch: number;
};

const byToken = new Map<string, Binding>();
const byRoom = new Map<string, Set<SocketLike>>();
const subscribed = new Map<string, Promise<() => Promise<void>>>();
const botAfterDisconnect = new Map<string, ReturnType<typeof setTimeout>>();

function clearBotAfterDisconnect(seatToken: string) {
  const timer = botAfterDisconnect.get(seatToken);
  if (timer) clearTimeout(timer);
  botAfterDisconnect.delete(seatToken);
}

function scheduleBotAfterDisconnect(
  roomCode: string,
  playerId: string,
  seatToken: string,
  wsEpoch: number,
) {
  clearBotAfterDisconnect(seatToken);
  botAfterDisconnect.set(
    seatToken,
    setTimeout(() => {
      botAfterDisconnect.delete(seatToken);
      void promoteDisconnectedToBot(roomCode, playerId, wsEpoch);
    }, DISCONNECT_TO_BOT_MS),
  );
}

function send(socket: SocketLike, message: ServerMessage) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    /* closed */
  }
}

function roomKey(code: string) {
  return code.trim().toUpperCase();
}

function addToRoom(roomCode: string, socket: SocketLike) {
  const code = roomKey(roomCode);
  const set = byRoom.get(code) ?? new Set();
  set.add(socket);
  byRoom.set(code, set);
  if (!subscribed.has(code)) {
    subscribed.set(
      code,
      getStore().subscribe(`room:${code}`, (_ch, raw) => {
        const payload = JSON.parse(raw) as ServerMessage;
        for (const peer of byRoom.get(code) ?? []) send(peer, payload);
      }),
    );
  }
}

function kickPlayer(roomCode: string, playerId: string) {
  const code = roomKey(roomCode);
  for (const peer of byToken.values()) {
    if (peer.roomCode !== code || peer.playerId !== playerId) continue;
    send(peer.socket, { type: "room:kicked" });
    peer.socket.close();
  }
}

function removeFromRoom(roomCode: string, socket: SocketLike) {
  const code = roomKey(roomCode);
  const set = byRoom.get(code);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) {
    byRoom.delete(code);
    const unsub = subscribed.get(code);
    subscribed.delete(code);
    void unsub?.then((fn) => fn());
  }
}

export function bindSocket(socket: SocketLike) {
  startDisconnectSweeper();
  let binding: Binding | null = null;
  let closed = false;

  const onMessage = async (raw: unknown) => {
    const text = typeof raw === "string" ? raw : raw instanceof Buffer ? raw.toString() : String(raw);
    let message: ClientMessage;
    try {
      message = JSON.parse(text) as ClientMessage;
    } catch {
      send(socket, { type: "room:error", error: "not_in_room", message: "Mensagem inválida." });
      return;
    }

    try {
      if (message.type === "room:join") {
        if (!isColorId(message.color)) throw new RoomError("invalid_color");
        const result = await joinRoom(message.roomCode, {
          nick: message.nick,
          color: message.color,
        });
        await attach(
          result.session.roomCode,
          result.session.playerId,
          result.session.seatToken,
          result.wsEpoch,
        );
        send(socket, { type: "session", session: result.session });
        send(socket, { type: "game:state", room: result.room });
        return;
      }

      if (message.type === "room:resume") {
        const result = await resumeRoom(message.roomCode, message.seatToken);
        await attach(
          result.session.roomCode,
          result.session.playerId,
          result.session.seatToken,
          result.wsEpoch,
        );
        send(socket, { type: "session", session: result.session });
        send(socket, {
          type: result.room.status === "finished" ? "game:over" : "game:state",
          room: result.room,
        });
        return;
      }

      if (!binding) throw new RoomError("not_in_room");

      if (message.type === "room:addBot") {
        const room = await addBot(binding.roomCode, binding.playerId);
        send(socket, { type: "game:state", room });
        return;
      }

      if (message.type === "room:addLocal") {
        const room = await addLocal(binding.roomCode, binding.playerId, message.nick, message.color);
        send(socket, { type: "game:state", room });
        return;
      }

      if (message.type === "room:removeBot" || message.type === "room:removePlayer") {
        const room = await removeBot(binding.roomCode, binding.playerId, message.playerId);
        kickPlayer(binding.roomCode, message.playerId);
        send(socket, { type: "game:state", room });
        return;
      }

      if (message.type === "room:setStarter") {
        const room = await setStarter(binding.roomCode, binding.playerId, message.playerId);
        send(socket, { type: "game:state", room });
        return;
      }

      if (message.type === "room:start") {
        const room = await startRoom(binding.roomCode, binding.playerId);
        send(socket, {
          type: room.status === "finished" ? "game:over" : "game:state",
          room,
        });
        return;
      }

      if (message.type === "game:draw") {
        const room = await drawEdge(binding.roomCode, binding.playerId, message.edge);
        send(socket, {
          type: room.status === "finished" ? "game:over" : "game:state",
          room,
        });
      }
    } catch (error) {
      if (error instanceof RoomError) {
        send(socket, { type: "room:error", error: error.code, message: error.message });
        return;
      }
      console.error(error);
      send(socket, {
        type: "room:error",
        error: "not_in_room",
        message: ERROR_MESSAGES.not_in_room,
      });
    }
  };

  async function attach(roomCode: string, playerId: string, seatToken: string, wsEpoch: number) {
    const previous = byToken.get(seatToken);
    if (previous && previous.socket !== socket) {
      send(previous.socket, { type: "resumed_elsewhere" });
      previous.socket.close();
    }
    if (binding) removeFromRoom(binding.roomCode, socket);
    binding = { socket, roomCode: roomKey(roomCode), playerId, seatToken, wsEpoch };
    byToken.set(seatToken, binding);
    addToRoom(roomCode, socket);
    clearBotAfterDisconnect(seatToken);
  }

  let chain = Promise.resolve();
  socket.on("message", (data) => {
    chain = chain.then(() => onMessage(data)).catch((error) => {
      console.error(error);
    });
  });

  socket.on("close", () => {
    if (closed) return;
    closed = true;
    if (!binding) return;
    if (byToken.get(binding.seatToken)?.socket === socket) {
      byToken.delete(binding.seatToken);
      void markDisconnected(binding.roomCode, binding.playerId, binding.wsEpoch);
      scheduleBotAfterDisconnect(
        binding.roomCode,
        binding.playerId,
        binding.seatToken,
        binding.wsEpoch,
      );
    }
    removeFromRoom(binding.roomCode, socket);
  });
}

export function startDisconnectSweeper() {
  /* conversion to bot is scheduled on socket close */
}
