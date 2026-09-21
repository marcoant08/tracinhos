import { NextResponse } from "next/server";
import { jsonError } from "./errors";

export function handle<T>(fn: () => Promise<T>, status = 200) {
  return fn()
    .then((data) =>
      NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "no-store" },
      }),
    )
    .catch((error) => {
      const { body, status: code } = jsonError(error);
      return NextResponse.json(body, { status: code });
    });
}
