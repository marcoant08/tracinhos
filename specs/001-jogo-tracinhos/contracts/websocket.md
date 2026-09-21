# Contrato WebSocket

URL: `ws(s)://{host}/ws`

Mensagens JSON com campo `type`. Uma conexão = no máximo um assento.

## Cliente → servidor

```json
{ "type": "room:join", "roomCode": "AB3K", "nick": "Bia", "color": "blue" }
{ "type": "room:resume", "roomCode": "AB3K", "seatToken": "opaque" }
{ "type": "room:addBot" }
{ "type": "room:start" }
{ "type": "game:draw", "edge": { "orientation": "h", "row": 0, "col": 0 } }
```

Join/resume também podem ter ocorrido via REST; nesse caso o cliente já tem `seatToken` e deve mandar `room:resume` ao abrir o socket (mesmo após join REST) para receber push.

## Servidor → cliente

```json
{ "type": "session", "session": { "playerId": "p1", "seatToken": "opaque", "nick": "Ana", "color": "red", "roomCode": "AB3K" } }
{ "type": "game:state", "room": { "...snapshot público..." } }
{ "type": "game:over", "room": { "...status finished..." } }
{ "type": "game:notice", "notice": "timeout_draw", "playerId": "p1", "nick": "Ana" }
{ "type": "room:error", "error": "not_your_turn", "message": "Não é a sua vez." }
{ "type": "resumed_elsewhere" }
```

`game:over` é enviado além de `game:state` quando `status` vira `finished`.

## Erros (`room:error.error`)

`room_not_found`, `invalid_nick`, `invalid_color`, `nick_taken`, `color_taken`, `room_full`, `game_already_started`, `not_host`, `not_enough_players`, `not_your_turn`, `illegal_move`, `invalid_token`, `not_in_room`.

## Reconnect

O servidor pode fechar o socket a qualquer momento (inclusive `maxDuration`). O cliente reconecta com backoff (1s, 2s, 4s, teto 30s) e envia `room:resume`.

Segunda conexão com o mesmo token: a anterior recebe `resumed_elsewhere` e o servidor a fecha.

## Snapshot

Idêntico ao GET REST. Sem `seatToken`. `game.scores` e `owners` usam `playerId`. `turnDeadlineAt` (no snapshot da sala) é epoch ms do fim da vez humana; o cliente deriva os segundos restantes.
