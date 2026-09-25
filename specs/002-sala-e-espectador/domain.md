# Domínio — presença, desafio e limite 3

Complementa [001/domain.md](../001-jogo-tracinhos/domain.md). O motor do traço não muda, salvo `MAX_PLAYERS`.

## Constantes (esta spec)

| Nome | Valor |
| --- | --- |
| `MAX_PLAYERS` | **3** (substitui o 5 da v1) |
| `PRESENCE_POLL_MS` | 3000 |
| `PRESENCE_TTL_MS` | 15000 |
| `CHALLENGE_TTL_MS` | 30000 |
| `STROKE_GROW_MS` | 280 |
| `LIVE_LIST_MAX` | 40 |
| `MAX_WATCHERS` | 30 |
| `WATCHER_TTL_MS` | 15000 |

`createGame(cols, playerIds, rows)` exige `playerIds.length ∈ [2, 3]`.

## Presença

Sem conta. Aparelho gera `presenceId` (uuid) + `presenceToken` opaco, gravados em `localStorage` (`tracinhos:presence`).

```
presenceId, presenceToken, nick, color, cols, rows,
status: "idle" | "seated" | "watching",
roomCode: string | null,
seenAt: epoch ms
```

- **idle:** home visível, nick válido, ping recente (`now - seenAt < PRESENCE_TTL_MS`), sem assento e sem `watchToken` numa sala viva. O cliente pinga a cada `PRESENCE_POLL_MS` (3 s), não a cada 1 s.
- **leave:** `POST /api/presence/leave` zera `seenAt`, tira do índice, expira desafio pendente. O token continua válido para o próximo ping.
- **seated:** tem `seatToken` numa sala viva. Não é alvo de desafio; na lista Online o botão vira **Jogando**.
- **watching:** tem `watchToken` numa sala `playing`. Tampouco é alvo de desafio; não entra na lista Online.
- Ping recusa token inválido. Nick/cor iguais às regras da v1.
- Índice Redis: `presence:{id}` (TTL curto) + conjunto `presence:index`.

A lista pública **não** inclui `presenceToken`. Só `presenceId`, nick, cor, `status`.

## Desafio

```
id, fromId, toId, cols, rows,
status: "pending" | "accepted" | "declined" | "expired",
roomCode: string | null,
createdAt, expiresAt
```

- Criar: `from` e `to` idle, distintos, **ambos frescos** (`isFresh`), sem outro `pending` envolvendo qualquer um dos dois. Alvo que já deu leave ou expirou: `challenge_gone` — o desafio **não** é criado.
- Aceitar (só `to`, ainda `pending`, não expirado): cria sala, senta `from` (host) e `to`, `status=accepted`, `roomCode` preenchido. Os dois viram `seated`.
- Recusar: `declined`. Expirar: `expired` (no GET, se `now ≥ expiresAt`).
- Snapshot de inbox do `to`: desafios `pending` válidos. Do `from`: o pendente que ele enviou + o `accepted` recente (para redirecionar).

## Ao vivo

Conjunto Redis `live:rooms` com os códigos em `playing`. `start` adiciona; `finished` (e sala sumida) remove.

Listagem: até `LIVE_LIST_MAX` salas, ordenadas por `updatedAt` desc. Cada item é um recorte público: código, grade, nicks, cores, scores, `{n}/3`. Sem tokens.

## Espectador

Não é um assento e **não** conta em `{n}/3`.

```
id, nick, color, watchToken, seenAt
```

- `POST .../watch` cria o registro (nick único vs jogadores + espectadores; cor única vs outros espectadores). Recusa `watchers_full` se `watchers.length ≥ MAX_WATCHERS`.
- Snapshot público: `watchers: [{ id, nick, color }]` (sem token) e dá para derivar o número.
- GET com `x-watch-token` renova `seenAt`. Sem ping por `WATCHER_TTL_MS`: some da lista.
- `watch:{token}` no Redis → `{ roomCode, watcherId }`.
- Não joga, não vira bot, não altera `starter` / start / addBot / removePlayer.

## Traço (só apresentação)

O `GameState` não ganha campo de origem. A animação é do cliente (`STROKE_GROW_MS`). Aresta nova vs aresta já vista: o cliente compara o snapshot anterior.

## Sala

`players.length` visível como `{length}/{MAX_PLAYERS}`. Host, starter, bots, timeout e `wsEpoch` iguais à v1.
