import { resumeWatch } from "@/lib/rooms";
import { handle } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return handle(async () => {
    const body = (await request.json()) as { watchToken?: string };
    return resumeWatch(code, body.watchToken ?? "");
  });
}
