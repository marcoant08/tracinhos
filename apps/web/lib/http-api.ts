import type { IncomingMessage, ServerResponse } from "node:http";
import {
  acceptChallenge,
  createChallenge,
  declineChallenge,
  getLobby,
  leavePresence,
  pingPresence,
} from "./presence";
import {
  actorFromToken,
  addLocal,
  createRoom,
  drawEdge,
  getPublicRoom,
  joinRoom,
  parseDrawEdge,
  resumeRoom,
  resumeWatch,
  watchRoom,
} from "./rooms";
import { jsonError, RoomError } from "./errors";

export async function handleRest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "POST" && pathname === "/api/rooms") {
      const body = await readJson(req);
      const result = await createRoom({
        size: asNumber(body.size),
        cols: asNumber(body.cols),
        rows: asNumber(body.rows),
        nick: asString(body.nick),
        color: asString(body.color),
      });
      return send(res, 201, result);
    }

    if (req.method === "GET" && pathname === "/api/lobby") {
      return send(res, 200, await getLobby(header(req, "x-presence-token")));
    }

    if (req.method === "POST" && pathname === "/api/presence") {
      const body = await readJson(req);
      const occupying = asOccupying(body.occupying);
      return send(
        res,
        200,
        await pingPresence({
          presenceToken: asString(body.presenceToken),
          nick: asString(body.nick),
          color: asString(body.color),
          cols: asNumber(body.cols),
          rows: asNumber(body.rows),
          occupying,
        }),
      );
    }

    if (req.method === "POST" && pathname === "/api/presence/leave") {
      const body = await readJson(req);
      return send(res, 200, await leavePresence(asString(body.presenceToken)));
    }

    if (req.method === "POST" && pathname === "/api/challenges") {
      const token = header(req, "x-presence-token");
      if (!token) throw new RoomError("invalid_token");
      const body = await readJson(req);
      return send(res, 201, await createChallenge(token, asString(body.toPresenceId)));
    }

    const acceptMatch = pathname.match(/^\/api\/challenges\/([^/]+)\/accept$/);
    if (req.method === "POST" && acceptMatch) {
      const token = header(req, "x-presence-token");
      if (!token) throw new RoomError("invalid_token");
      return send(res, 200, await acceptChallenge(token, decodeURIComponent(acceptMatch[1])));
    }

    const declineMatch = pathname.match(/^\/api\/challenges\/([^/]+)\/decline$/);
    if (req.method === "POST" && declineMatch) {
      const token = header(req, "x-presence-token");
      if (!token) throw new RoomError("invalid_token");
      return send(res, 200, await declineChallenge(token, decodeURIComponent(declineMatch[1])));
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (req.method === "GET" && roomMatch) {
      return send(
        res,
        200,
        await getPublicRoom(
          decodeURIComponent(roomMatch[1]),
          header(req, "x-seat-token"),
          header(req, "x-watch-token"),
        ),
      );
    }

    const localMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/local$/);
    if (req.method === "POST" && localMatch) {
      const body = await readJson(req);
      const code = decodeURIComponent(localMatch[1]);
      const playerId = await actorFromToken(code, asString(body.seatToken));
      return send(res, 200, {
        room: await addLocal(code, playerId, asString(body.nick), asString(body.color)),
      });
    }

    const joinMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const body = await readJson(req);
      const result = await joinRoom(decodeURIComponent(joinMatch[1]), {
        nick: asString(body.nick),
        color: asString(body.color),
      });
      return send(res, 200, result);
    }

    const resumeMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/resume$/);
    if (req.method === "POST" && resumeMatch) {
      const body = await readJson(req);
      const result = await resumeRoom(decodeURIComponent(resumeMatch[1]), asString(body.seatToken));
      return send(res, 200, result);
    }

    const watchResumeMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/watch\/resume$/);
    if (req.method === "POST" && watchResumeMatch) {
      const body = await readJson(req);
      return send(res, 200, await resumeWatch(decodeURIComponent(watchResumeMatch[1]), asString(body.watchToken)));
    }

    const watchMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/watch$/);
    if (req.method === "POST" && watchMatch) {
      const body = await readJson(req);
      return send(
        res,
        200,
        await watchRoom(decodeURIComponent(watchMatch[1]), {
          nick: asString(body.nick),
          color: asString(body.color),
        }),
      );
    }

    const drawMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/draw$/);
    if (req.method === "POST" && drawMatch) {
      const body = await readJson(req);
      const code = decodeURIComponent(drawMatch[1]);
      const playerId = await actorFromToken(code, asString(body.seatToken));
      return send(res, 200, {
        room: await drawEdge(code, playerId, parseDrawEdge(body.edge)),
      });
    }

    return send(res, 404, { error: "room_not_found", message: "Rota não encontrada." });
  } catch (error) {
    const { body, status } = jsonError(error);
    return send(res, status, body);
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function asOccupying(value: unknown): { roomCode: string; role: "seated" | "watching" } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { roomCode?: unknown; role?: unknown };
  if (typeof row.roomCode !== "string") return null;
  if (row.role !== "seated" && row.role !== "watching") return null;
  return { roomCode: row.roomCode, role: row.role };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
  return true;
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
