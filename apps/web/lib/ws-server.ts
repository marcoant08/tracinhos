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
  drawEdge,
  joinRoom,
  markDisconnected,
  promoteDisconnectedToBot,
  resumeRoom,
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

function scheduleBotAfterDisconnect(roomCode: string, playerId: string, seatToken: string) {
  clearBotAfterDisconnect(seatToken);
  botAfterDisconnect.set(
    seatToken,
    setTimeout(() => {
      botAfterDisconnect.delete(seatToken);
      void promoteDisconnectedToBot(roomCode, playerId);
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

function addToRoom(roomCode: string, socket: SocketLike) {
  const set = byRoom.get(roomCode) ?? new Set();
  set.add(socket);
  byRoom.set(roomCode, set);
  if (!subscribed.has(roomCode)) {
    subscribed.set(
      roomCode,
      getStore().subscribe(`room:${roomCode}`, (_ch, raw) => {
        const payload = JSON.parse(raw) as ServerMessage;
        for (const peer of byRoom.get(roomCode) ?? []) send(peer, payload);
      }),
    );
  }
}

function removeFromRoom(roomCode: string, socket: SocketLike) {
  const set = byRoom.get(roomCode);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) {
    byRoom.delete(roomCode);
    const unsub = subscribed.get(roomCode);
    subscribed.delete(roomCode);
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
        await attach(result.session.roomCode, result.session.playerId, result.session.seatToken);
        send(socket, { type: "session", session: result.session });
        send(socket, { type: "game:state", room: result.room });
        return;
      }

      if (message.type === "room:resume") {
        const result = await resumeRoom(message.roomCode, message.seatToken);
        await attach(result.session.roomCode, result.session.playerId, result.session.seatToken);
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

  async function attach(roomCode: string, playerId: string, seatToken: string) {
    const previous = byToken.get(seatToken);
    if (previous && previous.socket !== socket) {
      send(previous.socket, { type: "resumed_elsewhere" });
      previous.socket.close();
    }
    if (binding) removeFromRoom(binding.roomCode, socket);
    binding = { socket, roomCode, playerId, seatToken };
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
      void markDisconnected(binding.roomCode, binding.playerId);
      scheduleBotAfterDisconnect(binding.roomCode, binding.playerId, binding.seatToken);
    }
    removeFromRoom(binding.roomCode, socket);
  });
}

export function startDisconnectSweeper() {
  /* conversion to bot is scheduled on socket close */
}
