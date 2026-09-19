import type { IncomingMessage, ServerResponse } from "node:http";
import { createRoom, getPublicRoom, joinRoom, resumeRoom } from "./rooms";
import { jsonError } from "./errors";

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
        size: body.size,
        nick: body.nick ?? "",
        color: body.color ?? "",
      });
      return send(res, 201, result);
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (req.method === "GET" && roomMatch) {
      return send(res, 200, await getPublicRoom(decodeURIComponent(roomMatch[1])));
    }

    const joinMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const body = await readJson(req);
      const result = await joinRoom(decodeURIComponent(joinMatch[1]), {
        nick: body.nick ?? "",
        color: body.color ?? "",
      });
      return send(res, 200, result);
    }

    const resumeMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/resume$/);
    if (req.method === "POST" && resumeMatch) {
      const body = await readJson(req);
      const result = await resumeRoom(decodeURIComponent(resumeMatch[1]), body.seatToken ?? "");
      return send(res, 200, result);
    }

    return send(res, 404, { error: "room_not_found", message: "Rota não encontrada." });
  } catch (error) {
    const { body, status } = jsonError(error);
    return send(res, status, body);
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
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
