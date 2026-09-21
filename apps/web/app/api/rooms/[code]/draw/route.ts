import { actorFromToken, drawEdge } from "@/lib/rooms";
import { handle } from "@/lib/api";
import { RoomError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(async () => {
    const body = (await request.json()) as {
      seatToken?: string;
      edge?: { orientation?: "h" | "v"; row?: number; col?: number };
    };
    const playerId = await actorFromToken(code, body.seatToken ?? "");
    const edge = body.edge;
    if (
      (edge?.orientation !== "h" && edge?.orientation !== "v") ||
      !Number.isInteger(edge.row) ||
      !Number.isInteger(edge.col)
    ) {
      throw new RoomError("illegal_move");
    }
    return {
      room: await drawEdge(code, playerId, {
        orientation: edge.orientation,
        row: edge.row,
        col: edge.col,
      }),
    };
  });
}
