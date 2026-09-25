import { watchRoom } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(async () => {
    const body = (await request.json()) as { nick?: string; color?: string };
    return watchRoom(code, { nick: body.nick ?? "", color: body.color ?? "" });
  });
}
