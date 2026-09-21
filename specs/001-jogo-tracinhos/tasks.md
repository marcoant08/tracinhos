# Tarefas — implementação da spec

Cada item só é “feito” se o aceite da spec correspondente passar.

## 1. Motor (`packages/game`) — [domain.md](domain.md)

- [x] Constantes, tipos, `createGame` para `S` 2 e 10 e grade 10×15 pontos (`cols=9`, `rows=14`).
- [x] `isLegalEdge` / `applyMove`: ilegal, fora da vez.
- [x] Fecha 1 quadrado, pontua e **joga de novo**.
- [x] Fecha 2 quadrados no mesmo traço, +2, e **joga de novo**.
- [x] Sem fechar: avança turno (2+ jogadores).
- [x] Fim + vencedor único e empate.
- [x] `pickBotMove`: fecha se puder; evita 3 lados; se forçado, o lance que deixa menos.
- [x] Invariante: soma dos scores = quadrados com dono.
- [x] `countEdgesByPlayer`: soma dos traços = arestas com dono.
- [x] `turnDeadlineAt` + traço aleatório no nome de quem estoura 40s.

## 2. Contratos (`packages/shared`)

- [x] Paleta, erros, tipos REST/WS, chave `localStorage`, `normalizeNick`.

## 3. Salas + Redis (`apps/web/lib`)

- [x] Create / GET / join / resume.
- [x] Unicidade nick/cor, cheio, jogo já iniciado.
- [x] start / addBot (só host).
- [x] draw + bot loop até vez humana ou fim.
- [x] Disconnect 30s → bot; resume → humano.
- [x] Lock + pub/sub.
- [x] Delay do bot 1–2 s; timeout 40 s marca traço aleatório (servidor).

## 4. WebSocket

- [x] `/ws` local (server.ts) e na Vercel (upgrade).
- [x] Tipos do contrato; `resumed_elsewhere`.
- [x] Cliente: persistir sessão, resume no boot, backoff.
- [x] Lobby, join e partida buscam o snapshot a cada `LOBBY_POLL_MS` (Vercel: WS não cruza isolate).
- [x] Vez/clique pelo snapshot do servidor (traço otimista só pinta).

## 5. UI — [ui.md](ui.md)

- [x] Lobby `/`.
- [x] `/sala/[codigo]` join / lobby / playing / finished.
- [x] HUD fixo, tabuleiro pan/zoom, seletor de cores.
- [x] Mobile 360×640 + F5 no lobby e no jogo.
- [x] Toast de erro no canto superior direito em todas as telas.
- [x] Animação CSS de pressionar nos botões.
- [x] Tabuleiro escala para caber; todos os pontos visíveis; HUD altura fixa.
- [x] Tela de resultado no `finished` (vencedor em destaque).
- [x] Contador 40s (anel que esvazia) na vez humana; timeout marca traço aleatório + toast.
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
- [x] Lobby: select “Quem começa” (padrão Aleatório); host grava `starterPlayerId`; start usa essa escolha.
- [x] Preferência `tracinhos:identity` (nick+cor+grade) sobrevive a F5 nos formulários; nick/cor no criar/entrar; grade ao selecionar.
- [x] `BOT_NICKS` editável; addBot sorteia nome livre; fallback `Bot N`.
- [x] Nick do bot sempre com prefixo `Bot `; lista extra (Xandon, Barco, Zuão, …).
- [x] Borda/fade só na tela de quem está na vez (cor do jogador → laranja 10 s → vermelho 5 s). Faixa de WS no rodapé se o socket cair.
- [x] Relógio (anel + número) também na vez do bot; `turnDeadlineAt` preenchido.
- [x] Placar: vez atual em negrito + `👈`.
- [x] Placar HUD/resultado: quadrados com bolinha em cada canto e traços com bolinhas nas pontas.
- [x] Cliente segura o tabuleiro `RESULT_HOLD_MS` (3 s) antes do resultado; F5 em `finished` pula.
- [x] Bot pensa `BOT_THINK_MS` (1 s) **depois de publicar** cada snapshot; `/regras` diz 1 s. Traço do humano pinta na hora (otimista).
- [x] Traço otimista permanece até o snapshot; `preferRoom`/`updatedAt` evita GET velho apagar o lance.
- [x] Select do lobby: opção **10×15 pontos** (9×14 quadrados); motor e tabuleiro retangulares.
- [x] Local: `/ws` isolado do upgrade do Next (evita 1006). Lance confirma por REST para o relógio avançar.
