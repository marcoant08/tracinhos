import { declineChallenge } from "@/lib/presence";
import { handle } from "@/lib/api";
import { RoomError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handle(async () => {
    const token = request.headers.get("x-presence-token");
    if (!token) throw new RoomError("invalid_token");
    return declineChallenge(token, id);
  });
}
