import { actorFromToken, addLocal } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(async () => {
    const body = (await request.json()) as { seatToken?: string; nick?: string; color?: string };
    const playerId = await actorFromToken(code, body.seatToken ?? "");
    return { room: await addLocal(code, playerId, body.nick ?? "", body.color ?? "") };
  });
}
