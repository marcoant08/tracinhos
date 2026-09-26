import type { GameState } from "@tracinhos/game";

export const COLOR_IDS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "teal",
  "pink",
] as const;

export type ColorId = (typeof COLOR_IDS)[number];

export const COLOR_HEX: Record<ColorId, string> = {
  red: "#d64545",
  blue: "#2f6fed",
  green: "#2f9e5f",
  yellow: "#d4a017",
  purple: "#7b4fc7",
  orange: "#e06b20",
  teal: "#1f8a8a",
  pink: "#d4539b",
};

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const NICK_MIN = 2;
export const NICK_MAX = 16;
export const DISCONNECT_TO_BOT_MS = 30_000;
export const ROOM_TTL_SECONDS = 86_400;
export const SESSION_PREFIX = "tracinhos:session:";
export const IDENTITY_KEY = "tracinhos:identity";
export const TURN_TIMEOUT_MS = 40_000;
export const BOT_THINK_MS = 1_000;
export const RESULT_HOLD_MS = 3_000;
export const BOARD_GLOW_MS = 1_000;
export const LOBBY_POLL_MS = 1_000;
export const PRESENCE_POLL_MS = 3_000;
export const PRESENCE_TTL_MS = 15_000;
export const CHALLENGE_TTL_MS = 15_000;
export const STROKE_GROW_MS = 280;
export const LIVE_LIST_MAX = 40;
export const MAX_WATCHERS = 30;
export const WATCHER_TTL_MS = 15_000;
export const WATCH_PREFIX = "tracinhos:watch:";
export const PRESENCE_KEY = "tracinhos:presence";

export const COLOR_LABELS: Record<ColorId, string> = {
  red: "vermelho",
  blue: "azul",
  green: "verde",
  yellow: "amarelo",
  purple: "roxo",
  orange: "laranja",
  teal: "verde-água",
  pink: "rosa",
};

export const BOT_NICKS = [
  "Jompes",
  "Babigol",
  "Daniglover",
  "Micles",
  "Cayogre",
  "Murrycuck",
  "Gigi",
  "Fipe",
  "Pede-serra",
  "Gilb rick",
  "Beuberico",
  "Xandon",
  "Barco",
  "Zuão",
  "Tio Ita",
  "Oliver",
  "Teus",
  "Jiow",
  "Adilex",
  "Bobô",
  "Italiano",
  "Nalbs",
  "Wellbhs",
  "Welcareca",
  "Casca",
  "Bigs",
  "Tonts",
] as const;

export type RoomStatus = "lobby" | "playing" | "finished";
export type PlayerKind = "remote" | "local" | "bot";

export type PublicPlayer = {
  id: string;
  nick: string;
  color: ColorId;
  kind: PlayerKind;
  connected: boolean;
  ownerPlayerId?: string;
};

export type PublicWatcher = {
  id: string;
  nick: string;
  color: ColorId;
};

export type PublicRoom = {
  code: string;
  cols: number;
  rows: number;
  status: RoomStatus;
  hostPlayerId: string;
  players: PublicPlayer[];
  watchers: PublicWatcher[];
  takenNicks: string[];
  takenColors: ColorId[];
  game: GameState | null;
  turnDeadlineAt: number | null;
  starterPlayerId: string | null;
  updatedAt: number;
};

export type Session = {
  playerId: string;
  seatToken: string;
  nick: string;
  color: ColorId;
  roomCode: string;
};

export type WatchSession = {
  watcherId: string;
  watchToken: string;
  nick: string;
  color: ColorId;
  roomCode: string;
};

export type PresenceRecord = {
  presenceId: string;
  presenceToken: string;
};

export type PresenceStatus = "idle" | "seated" | "watching";

export type PublicPresence = {
  presenceId: string;
  nick: string;
  color: ColorId;
  status: PresenceStatus;
};

export type LiveRoom = {
  code: string;
  cols: number;
  rows: number;
  players: { nick: string; color: ColorId; squares: number }[];
  updatedAt: number;
};

export type ChallengePreview = {
  id: string;
  from: PublicPresence;
  cols: number;
  rows: number;
  expiresAt: number;
};

export type OutgoingChallenge = {
  id: string;
  to: PublicPresence;
  expiresAt: number;
};

export type LobbySnapshot = {
  online: PublicPresence[];
  live: LiveRoom[];
  inbox: ChallengePreview | null;
  outgoing: OutgoingChallenge | null;
  accepted: { roomCode: string; session: Session } | null;
};

export type ApiErrorCode =
  | "room_not_found"
  | "invalid_nick"
  | "invalid_color"
  | "invalid_size"
  | "nick_taken"
  | "color_taken"
  | "room_full"
  | "game_already_started"
  | "not_host"
  | "not_enough_players"
  | "not_your_turn"
  | "illegal_move"
  | "invalid_token"
  | "not_in_room"
  | "challenge_busy"
  | "challenge_pending"
  | "challenge_gone"
  | "challenge_self"
  | "watchers_full"
  | "not_playing";

export type ClientMessage =
  | { type: "room:join"; roomCode: string; nick: string; color: ColorId }
  | { type: "room:resume"; roomCode: string; seatToken: string }
  | { type: "room:addBot" }
  | { type: "room:addLocal"; nick: string; color: ColorId }
  | { type: "room:removeBot"; playerId: string }
  | { type: "room:removePlayer"; playerId: string }
  | { type: "room:setStarter"; playerId: string | null }
  | { type: "room:start" }
  | { type: "game:draw"; edge: { orientation: "h" | "v"; row: number; col: number } };

export type ServerMessage =
  | { type: "session"; session: Session }
  | { type: "game:state"; room: PublicRoom }
  | { type: "game:over"; room: PublicRoom }
  | { type: "game:notice"; notice: "timeout_draw"; playerId: string; nick: string }
  | { type: "room:error"; error: ApiErrorCode; message: string }
  | { type: "resumed_elsewhere" }
  | { type: "room:kicked" };

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  room_not_found: "Sala não encontrada.",
  invalid_nick: "Nick inválido (2 a 16 caracteres).",
  invalid_color: "Escolha uma cor da paleta.",
  invalid_size: "Tamanho da grade inválido (2 a 14 quadrados em cada lado).",
  nick_taken: "Esse nick já foi escolhido.",
  color_taken: "Essa cor já foi escolhida.",
  room_full: "A sala já tem 3 jogadores.",
  game_already_started: "A partida já começou.",
  not_host: "Só o host pode fazer isso.",
  not_enough_players: "Precisa de pelo menos 2 participantes.",
  not_your_turn: "Não é a sua vez.",
  illegal_move: "Esse traço não vale.",
  invalid_token: "Sessão inválida. Entre de novo.",
  not_in_room: "Você não está nesta sala.",
  challenge_busy: "Essa pessoa está ocupada.",
  challenge_pending: "Já existe um desafio pendente.",
  challenge_gone: "Esse desafio não vale mais.",
  challenge_self: "Você não pode desafiar a si mesmo.",
  watchers_full: "Essa sala já tem muitos espectadores.",
  not_playing: "Essa partida ainda não começou.",
};

export function watchStorageKey(roomCode: string): string {
  return `${WATCH_PREFIX}${roomCode.toUpperCase()}`;
}

export function normalizeNick(nick: string): string {
  return nick.trim();
}

export function nickKey(nick: string): string {
  return normalizeNick(nick).toLocaleLowerCase("pt-BR");
}

export function isValidNick(nick: string): boolean {
  const n = normalizeNick(nick);
  return n.length >= NICK_MIN && n.length <= NICK_MAX && !/[\n\r]/.test(n);
}

export function isColorId(value: string): value is ColorId {
  return (COLOR_IDS as readonly string[]).includes(value);
}

export function sessionStorageKey(roomCode: string): string {
  return `${SESSION_PREFIX}${roomCode.toUpperCase()}`;
}

function displayBotNick(name: string) {
  return `Bot ${name}`;
}

export function pickBotColor(taken: readonly ColorId[], random: () => number = Math.random): ColorId | null {
  const free = COLOR_IDS.filter((id) => !taken.includes(id));
  if (free.length === 0) return null;
  const index = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
  return free[index];
}

export function pickBotNick(takenNicks: string[], random: () => number = Math.random): string {
  const taken = new Set(takenNicks.map(nickKey));
  const free = BOT_NICKS.filter((name) => !taken.has(nickKey(displayBotNick(name))));
  if (free.length > 0) {
    const index = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
    return displayBotNick(free[index]);
  }
  let n = 1;
  let nick = `Bot ${n}`;
  while (taken.has(nickKey(nick))) {
    n += 1;
    nick = `Bot ${n}`;
  }
  return nick;
}
