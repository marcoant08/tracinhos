import { createRoom } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as {
      size?: number;
      cols?: number;
      rows?: number;
      nick?: string;
      color?: string;
    };
    return createRoom({
      size: body.size,
      cols: body.cols,
      rows: body.rows,
      nick: body.nick ?? "",
      color: body.color ?? "",
    });
  }, 201);
}
