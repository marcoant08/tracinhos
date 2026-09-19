import { ERROR_MESSAGES, type ApiErrorCode } from "@tracinhos/shared";

export class RoomError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "RoomError";
    this.code = code;
    this.status = statusOf(code);
  }
}

function statusOf(code: ApiErrorCode): number {
  switch (code) {
    case "room_not_found":
      return 404;
    case "invalid_token":
      return 401;
    case "not_host":
    case "not_your_turn":
    case "not_in_room":
      return 403;
    case "nick_taken":
    case "color_taken":
    case "room_full":
    case "game_already_started":
    case "not_enough_players":
      return 409;
    default:
      return 400;
  }
}

export function jsonError(error: unknown): { body: { error: string; message: string }; status: number } {
  if (error instanceof RoomError) {
    return { body: { error: error.code, message: error.message }, status: error.status };
  }
  console.error(error);
  return { body: { error: "invalid_nick", message: "Erro inesperado." }, status: 500 };
}
