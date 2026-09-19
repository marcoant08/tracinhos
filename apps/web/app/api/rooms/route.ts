import { createRoom } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as { size?: number; nick?: string; color?: string };
    return createRoom({
      size: body.size,
      nick: body.nick ?? "",
      color: body.color ?? "",
    });
  }, 201);
}
