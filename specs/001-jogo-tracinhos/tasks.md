# Tarefas — implementação da spec

Cada item só é “feito” se o aceite da spec correspondente passar.

## 1. Motor (`packages/game`) — [domain.md](domain.md)

- [x] Constantes, tipos, `createGame` para `S` 2 e 10 e grade 10×15 pontos (`cols=9`, `rows=14`).
- [x] `isLegalEdge` / `applyMove`: ilegal, fora da vez.
- [x] Fecha 1 quadrado, pontua e **joga de novo**.
- [x] Fecha 2 quadrados no mesmo traço, +2, e **joga de novo**.
- [x] Sem fechar: avança turno (2+ jogadores).
- [x] Fim + vencedor único e empate.
- [x] `pickBotMove` guloso determinístico (fecha se puder; senão primeira legal).
- [x] Invariante: soma dos scores = quadrados com dono.
- [x] `countEdgesByPlayer`: soma dos traços = arestas com dono.
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
- [x] Lobby (e o join sem sessão) busca o snapshot a cada `LOBBY_POLL_MS`.
- [x] Vez/clique pelo snapshot do servidor (traço otimista só pinta). Sem poll contínuo na partida.

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
- [x] Página `/regras` ligada à home e à sala (não no resultado).
- [x] Bot pensa 1–2 s antes de jogar.
- [x] “Copiar link” copia `{origin}/sala/{codigo}`.
- [x] Copy de join: “Entrar”, nunca “Sentar”.
- [x] Bolinha da cor maior; placar com nick, quadrados e traços separados.

## 6. Empacotar

- [x] workspaces, Docker Compose (`web` + `redis`), `vercel.json`, README com `docker compose up --build` e `REDIS_URL`.

## 7. Polimento (esta fatia)

- [x] Select da grade maior (min-height 56px, fonte ≥ 1.15rem) no lobby.
- [x] “Adicionar bot” desabilitado com sala cheia (`MAX_PLAYERS`).
- [x] Preferência `tracinhos:identity` (nick+cor+grade) sobrevive a F5 nos formulários; nick/cor no criar/entrar; grade ao selecionar.
- [x] `BOT_NICKS` editável; addBot sorteia nome livre; fallback `Bot N`.
- [x] Nick do bot sempre com prefixo `Bot `; lista extra (Xandon, Barco, Zuão, …).
- [x] Vinheta no papel: acende e apaga **uma vez** (~1 s) e volta ao normal.
- [x] Relógio (anel + número) também na vez do bot; `turnDeadlineAt` preenchido.
- [x] Placar: vez atual em negrito + `👈`.
- [x] Placar HUD/resultado: quadrados `□` e traços com bolinhas nas pontas.
- [x] Cliente segura o tabuleiro `RESULT_HOLD_MS` (3 s) antes do resultado; F5 em `finished` pula.
- [x] Bot pensa `BOT_THINK_MS` (1 s) **depois de publicar** cada snapshot; `/regras` diz 1 s. Traço do humano pinta na hora (otimista).
- [x] Traço otimista permanece até o snapshot; sem poll de 1,5 s que apagava o lance.
- [x] Select do lobby: opção **10×15 pontos** (9×14 quadrados); motor e tabuleiro retangulares.
- [x] Local: `/ws` isolado do upgrade do Next (evita 1006). Lance confirma por REST para o relógio avançar.
