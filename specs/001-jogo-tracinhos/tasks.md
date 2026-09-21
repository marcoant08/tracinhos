# Tarefas — implementação da spec

Cada item só é “feito” se o aceite da spec correspondente passar.

## 1. Motor (`packages/game`) — [domain.md](domain.md)

- [x] Constantes, tipos, `createGame` para `S` 2 e 10.
- [x] `isLegalEdge` / `applyMove`: ilegal, fora da vez.
- [x] Fecha 1 quadrado, pontua e **joga de novo**.
- [x] Fecha 2 quadrados no mesmo traço, +2, e **joga de novo**.
- [x] Sem fechar: avança turno (2+ jogadores).
- [x] Fim + vencedor único e empate.
- [x] `pickBotMove` guloso determinístico (fecha se puder; senão primeira legal).
- [x] Invariante: soma dos scores = quadrados com dono.
- [x] `turnDeadlineAt` + traço aleatório no nome de quem estoura 25s.

## 2. Contratos (`packages/shared`)

- [x] Paleta, erros, tipos REST/WS, chave `localStorage`, `normalizeNick`.

## 3. Salas + Redis (`apps/web/lib`)

- [x] Create / GET / join / resume.
- [x] Unicidade nick/cor, cheio, jogo já iniciado.
- [x] start / addBot (só host).
- [x] draw + bot loop até vez humana ou fim.
- [x] Disconnect 30s → bot; resume → humano.
- [x] Lock + pub/sub.
- [x] Delay do bot 1–2 s; timeout 25 s marca traço aleatório (servidor).

## 4. WebSocket

- [x] `/ws` local (server.ts) e na Vercel (upgrade).
- [x] Tipos do contrato; `resumed_elsewhere`.
- [x] Cliente: persistir sessão, resume no boot, backoff.

## 5. UI — [ui.md](ui.md)

- [x] Lobby `/`.
- [x] `/sala/[codigo]` join / lobby / playing / finished.
- [x] HUD fixo, tabuleiro pan/zoom, seletor de cores.
- [x] Mobile 360×640 + F5 no lobby e no jogo.
- [x] Toast de erro no canto superior direito em todas as telas.
- [x] Animação CSS de pressionar nos botões.
- [x] Tabuleiro escala para caber; todos os pontos visíveis; HUD altura fixa.
- [x] Tela de resultado no `finished` (vencedor em destaque).
- [x] Contador 25s (anel que esvazia) na vez humana; timeout marca traço aleatório + toast.
- [x] Página `/regras` ligada ao lobby.
- [x] Bot pensa 1–2 s antes de jogar.
- [x] “Copiar link” copia `{origin}/sala/{codigo}`.
- [x] Copy de join: “Entrar”, nunca “Sentar”.
- [x] Bolinha da cor maior; placar com nick e pontos separados.

## 6. Empacotar

- [x] workspaces, Docker Compose (`web` + `redis`), `vercel.json`, README com `docker compose up --build` e `REDIS_URL`.
