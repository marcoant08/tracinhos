import { getPublicRoom } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(() => getPublicRoom(code));
}
