import { getLobby } from "@/lib/presence";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handle(() => getLobby(request.headers.get("x-presence-token")));
}
