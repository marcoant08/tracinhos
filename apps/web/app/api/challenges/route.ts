import { createChallenge } from "@/lib/presence";
import { handle } from "@/lib/api";
import { RoomError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const token = request.headers.get("x-presence-token");
    if (!token) throw new RoomError("invalid_token");
    const body = (await request.json()) as { toPresenceId?: string };
    return createChallenge(token, body.toPresenceId ?? "");
  }, 201);
}
