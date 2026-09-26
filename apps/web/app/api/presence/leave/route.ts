import { leavePresence } from "@/lib/presence";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    let presenceToken = "";
    let roomCode = "";
    let seatToken = "";
    const contentType = request.headers.get("content-type") ?? "";
    const readBody = (raw: { presenceToken?: string; roomCode?: string; seatToken?: string }) => {
      presenceToken = raw.presenceToken ?? "";
      roomCode = raw.roomCode ?? "";
      seatToken = raw.seatToken ?? "";
    };
    if (contentType.includes("application/json")) {
      readBody((await request.json()) as { presenceToken?: string; roomCode?: string; seatToken?: string });
    } else {
      const text = await request.text();
      try {
        readBody(JSON.parse(text) as { presenceToken?: string; roomCode?: string; seatToken?: string });
      } catch {
        const params = new URLSearchParams(text);
        presenceToken = params.get("presenceToken") ?? "";
        roomCode = params.get("roomCode") ?? "";
        seatToken = params.get("seatToken") ?? "";
      }
    }
    return leavePresence(
      presenceToken,
      roomCode && seatToken ? { roomCode, seatToken } : null,
    );
  });
}
