# Contrato REST

Base: `/api`. JSON. Sem autenticação além do `seatToken` quando exigido.

## `GET /api/rooms/:code`

Snapshot público da sala (sem tokens).

**200**

```json
{
  "code": "AB3K",
  "size": 5,
  "status": "lobby",
  "hostPlayerId": "p1",
  "players": [
    { "id": "p1", "nick": "Ana", "color": "red", "kind": "human", "connected": true }
  ],
  "takenNicks": ["ana"],
  "takenColors": ["red"],
  "game": null
}
```

`takenNicks` já em minúsculas (chave de unicidade). `game` é o `GameState` público ou `null`.

**404** `{ "error": "room_not_found" }`

## `POST /api/rooms`

Cria sala e coloca o host nela.

**Body**

```json
{ "size": 5, "nick": "Ana", "color": "red" }
```

`size` opcional; default 5.

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
