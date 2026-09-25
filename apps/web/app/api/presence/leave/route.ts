import { leavePresence } from "@/lib/presence";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    let presenceToken = "";
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { presenceToken?: string };
      presenceToken = body.presenceToken ?? "";
    } else {
      const text = await request.text();
      try {
        presenceToken = ((JSON.parse(text) as { presenceToken?: string }).presenceToken ?? "").toString();
      } catch {
        presenceToken = new URLSearchParams(text).get("presenceToken") ?? "";
      }
    }
    return leavePresence(presenceToken);
  });
}
