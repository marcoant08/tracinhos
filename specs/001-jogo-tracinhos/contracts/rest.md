# Contrato REST

Base: `/api`. JSON. Sem autenticação além do `seatToken` quando exigido.

## `GET /api/rooms/:code`

Snapshot público da sala (sem tokens). Em `lobby` e `playing` o cliente busca a cada `LOBBY_POLL_MS` (aba visível): na Vercel o WS não entrega o lance para outro isolate.

**200**

```json
{
  "code": "AB3K",
  "cols": 5,
  "rows": 5,
  "status": "lobby",
  "hostPlayerId": "p1",
  "players": [
    { "id": "p1", "nick": "Ana", "color": "red", "kind": "human", "connected": true }
  ],
  "takenNicks": ["ana"],
  "takenColors": ["red"],
  "game": null,
  "turnDeadlineAt": null,
  "starterPlayerId": null,
  "updatedAt": 1710000000000
}
```

`takenNicks` já em minúsculas (chave de unicidade). `game` é o `GameState` público ou `null`. `starterPlayerId` é quem o host escolheu para abrir (`null` = aleatório). `updatedAt` é epoch ms da última mutação da sala.

**404** `{ "error": "room_not_found" }`

## `POST /api/rooms`

Cria sala e coloca o host nela.

**Body**

```json
{ "cols": 5, "rows": 5, "nick": "Ana", "color": "red" }
```

`cols` e `rows` = quadrados na horizontal e na vertical (`[2, 14]`). Atalho `size` ainda vale para grade quadrada (`cols = rows = size`). Default 5×5. Preset 10×15 pontos: `{ "cols": 9, "rows": 14 }`.

**201**

```json
{
  "room": { "...snapshot público..." },
  "session": {
    "playerId": "p1",
    "seatToken": "opaque",
    "nick": "Ana",
    "color": "red",
    "roomCode": "AB3K"
  }
}
```

**400** `{ "error": "invalid_nick" | "invalid_color" | "invalid_size" }`

## `POST /api/rooms/:code/join`

Senta humano no lobby.

**Body** `{ "nick": "Bia", "color": "blue" }`

**200** mesmo formato de 201 acima.

**400/404/409** `{ "error": "room_not_found" | "invalid_nick" | "invalid_color" | "nick_taken" | "color_taken" | "room_full" | "game_already_started" }`

## `POST /api/rooms/:code/resume`

**Body** `{ "seatToken": "opaque" }`

**200** snapshot + session (nick/cor/id originais).

**401/404** `{ "error": "invalid_token" | "room_not_found" }`

## `POST /api/rooms/:code/draw`

Marca um traço. Mesma regra do `game:draw` no WebSocket. O cliente usa esta rota na partida para confirmar o lance (e o prazo) mesmo se o socket local cair.

**Body** `{ "seatToken": "opaque", "edge": { "orientation": "h", "row": 0, "col": 0 } }`

**200** `{ "room": { "...snapshot público..." } }`

**400/401/403/404** `{ "error": "invalid_token" | "illegal_move" | "not_your_turn" | "room_not_found" }`
