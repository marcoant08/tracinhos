# Plano técnico — v2

Implementa [spec.md](spec.md). Código só depois desta pasta existir.

## O que muda no monorepo

- `packages/game`: `MAX_PLAYERS = 3`.
- `packages/shared`: TTL de presença/desafio, `STROKE_GROW_MS`, erros novos, tipos `Presence`, `Challenge`, `LiveRoom`.
- `apps/web/lib/presence.ts` (novo): ping, inbox, criar/aceitar/recusar desafio.
- `apps/web/lib/rooms.ts`: índice `live:rooms`; `watchers` + `watchToken`; join/addBot com `MAX_PLAYERS` 3.
- `apps/web`: home ganha listas; `RoomApp` ganha formulário **Assistir** + `watching`; HUD com olho/balão; `Board` anima traço; caneta; sheet `?`.

## ADRs

### ADR 6 — Presença sem conta

`presenceId` + `presenceToken` no `localStorage`. Redis `presence:{id}` com TTL ~20 s (maior que `PRESENCE_TTL_MS`). Ping renova. Sem isso a lista “online” exigiria login (fora de escopo).

### ADR 7 — Inbox por poll

Desafio e ao vivo na Vercel: `GET /api/lobby` a cada `PRESENCE_POLL_MS` (3 s) (presenças idle + partidas live + inbox do token). Não depender de pub/sub entre isolates. Aceitar/recusar/criar são POST.

### ADR 8 — Índice de partidas ao vivo

`startRoom` faz `SADD live:rooms {code}`; fim faz `SREM`. O GET monta os snapshots. Sem varrer todas as chaves `room:*`.

### ADR 9 — Espectador tem identidade, não assento

Nick/cor obrigatórios via `POST /api/rooms/:code/watch` → `watchToken` no `localStorage` (`tracinhos:watch:{code}`). Não joga. O GET da sala com `x-watch-token` mantém o espectador na lista. Sem token a UI mostra o formulário **Assistir**, não o tabuleiro.

### ADR 10 — Animação só no cliente

Não gravar origem do clique no Redis. Quem jogou neste aparelho usa o ponto selecionado; os outros usam a direção canônica da aresta.

## Redis (além da v1)

- `presence:{id}` — JSON + TTL
- `presence:index` — SET de ids
- `challenge:{id}` — JSON + TTL
- `inbox:{presenceId}` — id do desafio pendente (ou vazio)
- `live:rooms` — SET de códigos `playing`
- `watch:{token}` — `{ roomCode, watcherId }` (TTL alinhado à sala)

## Riscos

- Ping a 3 s × N pessoas na home: 1 GET+SET de presença por cliente. O GET de lobby agrega lista+inbox+live num request. Partida (jogar/assistir) segue `LOBBY_POLL_MS` (1 s).
- Aceitar desafio: lock nos dois presence + criar sala, para não sentar duas vezes.
- Sala antiga no Redis com 4–5 jogadores: `ROOM_TTL` as enterra; código novo já limita 3.
