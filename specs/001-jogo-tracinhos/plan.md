# Plano técnico — Jogo dos Tracinhos

Implementa [spec.md](spec.md) e [domain.md](domain.md) no monorepo npm.

## Arquitetura

```
apps/web          Next.js (UI + REST + upgrade WebSocket)
packages/game     motor puro (domain.md)
packages/shared   tipos e constantes dos contratos
Redis             snapshot da sala + pub/sub + token→playerId
```

O cliente nunca aplica regra. Envia intenção; recebe snapshot.

## ADRs

### ADR 1 — Next.js num único projeto Vercel

Front e rotas Node no mesmo app. Evita dois deploys. `transpilePackages` inclui `game` e `shared`.

### ADR 2 — WebSocket nativo, não Socket.IO

Vercel Functions aceitam upgrade WS (Fluid compute). Socket.IO exige adapter e sticky sessions extras. Mensagens JSON com `type`.

Localmente um `server.mjs` HTTP+WS serve o Next e o mesmo protocolo em `/ws`. Na Vercel, route handler faz o upgrade no mesmo path.

### ADR 3 — Redis como fonte da verdade

Chaves:

- `room:{code}` — JSON da sala (TTL 86400s)
- `seat:{token}` — `{ roomCode, playerId }` (TTL igual)
- pub/sub `room:{code}` — fan-out do snapshot

Mutações usam lock `lock:room:{code}` (SET NX PX) para serializar jogadas.

### ADR 4 — Docker só no local

`docker compose up --build` sobe `redis` + `web`. Produção: Vercel + `REDIS_URL` (Upstash rediss).

### ADR 5 — Custom server no container

`next start` sozinho não anexa WS. A imagem roda `tsx server.ts` (Next + `ws` em `/ws`).

Localmente o `server.ts` também atende `/api/*` no mesmo processo do WebSocket, para o store em memória (sem Redis) ser único. Na Vercel as route handlers + Redis fazem o mesmo papel.

## Módulos

- `packages/game`: `createGame`, `applyMove`, `pickBotMove`, `isLegalEdge`, constantes.
- `packages/shared`: paleta, tipos REST/WS, códigos de erro, chave de `localStorage`.
- `apps/web/lib/rooms.ts`: create/join/resume/start/addBot/draw + Redis.
- `apps/web/lib/ws.ts`: parse de mensagens, bind conexão ↔ assento.
- `apps/web/app`: páginas `/` e `/sala/[codigo]`.

## Sessão (F5)

`localStorage` chave `tracinhos:session:{roomCode}`:

```
{ playerId, seatToken, nick, color, roomCode }
```

Boot: se existir, `room:resume`. Senão, formulário.

## Riscos

- `maxDuration` da Vercel fecha o WS: o cliente reconecta e resume.
- Duas instâncias: pub/sub obrigatório; teste local com um processo é insuficiente para provar fan-out, mas o código de publish é o mesmo.
