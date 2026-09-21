import { actorFromToken, drawEdge, parseDrawEdge } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(async () => {
    const body = (await request.json()) as { seatToken?: string; edge?: unknown };
    const playerId = await actorFromToken(code, body.seatToken ?? "");
    return { room: await drawEdge(code, playerId, parseDrawEdge(body.edge)) };
  });
}
