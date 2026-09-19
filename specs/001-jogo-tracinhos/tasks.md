# Tarefas — implementação da spec

Cada item só é “feito” se o aceite da spec correspondente passar.

## 1. Motor (`packages/game`) — [domain.md](domain.md)

- [x] Constantes, tipos, `createGame` para `S` 2 e 10.
- [x] `isLegalEdge` / `applyMove`: ilegal, fora da vez.
- [x] Fecha 1 quadrado + jogada extra.
- [x] Fecha 2 quadrados no mesmo traço + uma extra + scores +2.
- [x] Sem fechar: avança turno (2+ jogadores).
- [x] Fim + vencedor único e empate.
- [x] `pickBotMove` guloso determinístico (fecha se puder; senão primeira legal).
- [x] Invariante: soma dos scores = quadrados com dono.

## 2. Contratos (`packages/shared`)

- [x] Paleta, erros, tipos REST/WS, chave `localStorage`, `normalizeNick`.

## 3. Salas + Redis (`apps/web/lib`)

- [x] Create / GET / join / resume.
- [x] Unicidade nick/cor, cheio, jogo já iniciado.
- [x] start / addBot (só host).
- [x] draw + bot loop até vez humana ou fim.
- [x] Disconnect 30s → bot; resume → humano.
- [x] Lock + pub/sub.

## 4. WebSocket

- [x] `/ws` local (server.ts) e na Vercel (upgrade).
- [x] Tipos do contrato; `resumed_elsewhere`.
- [x] Cliente: persistir sessão, resume no boot, backoff.

## 5. UI — [ui.md](ui.md)

- [x] Lobby `/`.
- [x] `/sala/[codigo]` join / lobby / playing / finished.
- [x] HUD fixo, tabuleiro pan/zoom, seletor de cores.
- [x] Mobile 360×640 + F5 no lobby e no jogo.

## 6. Empacotar

- [x] workspaces, Docker Compose (`web` + `redis`), `vercel.json`, README com `docker compose up --build` e `REDIS_URL`.
