# Contrato REST — v2

Soma ao [001](../../001-jogo-tracinhos/contracts/rest.md). Join/addBot: cheio em **3**.

## `GET /api/lobby`

Agrega home. Header opcional `x-presence-token`. O cliente busca a cada `PRESENCE_POLL_MS` (3 s) com a aba visível — não usa o poll de 1 s da partida.

**200**

```json
{
  "online": [
    { "presenceId": "e1", "nick": "Bia", "color": "blue" }
  ],
  "live": [
    {
      "code": "AB3K",
      "cols": 5,
      "rows": 5,
      "players": [
        { "nick": "Ana", "color": "red", "squares": 2 },
        { "nick": "Bia", "color": "blue", "squares": 1 }
      ],
      "updatedAt": 1710000000000
    }
  ],
  "inbox": {
    "id": "c1",
    "from": { "presenceId": "e2", "nick": "Ana", "color": "red" },
    "cols": 5,
    "rows": 5,
    "expiresAt": 1710000030000
  },
  "outgoing": null,
  "accepted": null
}
```

- `online`: só `idle` de **outros** aparelhos (nunca o dono do token). Sem token: lista igual, `inbox`/`outgoing`/`accepted` nulos.
- `live`: até `LIVE_LIST_MAX` salas `playing`.
- `inbox`: desafio `pending` **para** este token, ou `null`.
- `outgoing`: desafio `pending` **deste** token, ou `null`.
- `accepted`: `{ "roomCode": "AB3K", "session": { "...session..." } }` só logo após **este** aparelho aceitar ou ter o desafio aceito (o cliente redireciona e para de mostrar). Uma vez lido, o servidor pode limpar.

**400** `{ "error": "invalid_token" }` se o header existir e for inválido.

## `POST /api/presence`

Heartbeat da home.

**Body** `{ "presenceToken": "opaque-or-empty", "nick": "Ana", "color": "red", "cols": 5, "rows": 5 }`

Token vazio: o servidor cria `presenceId`+token. Nick inválido: presença **não** entra em `online` (ainda devolve token para o aparelho).

**200** `{ "presence": { "presenceId": "e1", "presenceToken": "opaque" } }`

## `POST /api/challenges`

**Headers** `x-presence-token`

**Body** `{ "toPresenceId": "e2" }`

Grade = `cols`/`rows` gravados no ping do desafiante.

**201** `{ "challenge": { "id": "c1", "expiresAt": 1710000030000 } }`

**409** `{ "error": "challenge_busy" | "challenge_pending" | "challenge_gone" | "challenge_self" }`

## `POST /api/challenges/:id/accept`

**Headers** `x-presence-token` (o `to`)

**200** `{ "room": { "...snapshot..." }, "session": { "...aceitante..." } }`

O desafiante descobre a sala no próximo `GET /api/lobby` → `accepted.session` (host).

**409/404** `{ "error": "challenge_gone" | "challenge_busy" | "room_full" }`

## `POST /api/challenges/:id/decline`

**Headers** `x-presence-token` (o `to`)

**200** `{ "ok": true }`

**404** `{ "error": "challenge_gone" }`

## `GET /api/rooms/:code`

Igual à v1, mais `watchers` no snapshot (sem tokens):

```json
"watchers": [
  { "id": "w1", "nick": "Cris", "color": "green" }
]
```

`takenNicks` inclui jogadores **e** espectadores. Headers opcionais: `x-seat-token` (jogador) ou `x-watch-token` (espectador; renova `seenAt`). Sem token em `playing` devolve o snapshot, mas o cliente **não** mostra o tabuleiro até ter `watchToken`.

## `POST /api/rooms/:code/watch`

Registra espectador em sala `playing`.

**Body** `{ "nick": "Cris", "color": "green" }`

**200**

```json
{
  "room": { "...snapshot com watchers..." },
  "watch": {
    "watcherId": "w1",
    "watchToken": "opaque",
    "nick": "Cris",
    "color": "green",
    "roomCode": "AB3K"
  }
}
```

**400/404/409** `{ "error": "invalid_nick" | "invalid_color" | "nick_taken" | "color_taken" | "watchers_full" | "room_not_found" | "not_playing" }`

`color_taken` só se outro **espectador** já tem a cor. `not_playing` se a sala não está `playing`.

## `POST /api/rooms/:code/watch/resume`

**Body** `{ "watchToken": "opaque" }`

**200** mesmo formato de watch. **401/404** `{ "error": "invalid_token" | "room_not_found" }`
