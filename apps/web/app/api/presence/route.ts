import { pingPresence } from "@/lib/presence";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json()) as {
      presenceToken?: string;
      nick?: string;
      color?: string;
      cols?: number;
      rows?: number;
      occupying?: { roomCode?: string; role?: string } | null;
    };
    let occupying: { roomCode: string; role: "seated" | "watching" } | null = null;
    if (body.occupying?.roomCode && (body.occupying.role === "seated" || body.occupying.role === "watching")) {
      occupying = { roomCode: body.occupying.roomCode, role: body.occupying.role };
    }
    return pingPresence({
      presenceToken: body.presenceToken ?? "",
      nick: body.nick ?? "",
      color: body.color ?? "",
      cols: body.cols,
      rows: body.rows,
      occupying,
    });
  });
}
