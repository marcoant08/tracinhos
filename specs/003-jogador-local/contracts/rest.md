# Contrato REST — v3

Soma ao [002](../../002-sala-e-espectador/contracts/rest.md).

Jogador no snapshot:

```json
{
  "id": "p2",
  "nick": "Bia",
  "color": "blue",
  "kind": "local",
  "ownerPlayerId": "p1",
  "connected": true
}
```

`kind` é `"remote" | "local" | "bot"`. `ownerPlayerId` vem só se `local`; senão omitido ou `null`.

## `POST /api/rooms/:code/local`

**Body** `{ "seatToken": "opaque", "nick": "Bia", "color": "blue" }`

**200** `{ "room": { "...snapshot..." } }`

**400/403/409** `{ "error": "invalid_nick" | "invalid_color" | "nick_taken" | "color_taken" | "room_full" | "game_already_started" | "invalid_token" | "not_in_room" }`
