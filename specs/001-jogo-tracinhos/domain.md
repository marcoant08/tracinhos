# Domínio — regras do Jogo dos Tracinhos

Motor puro. Sem I/O. Implementação: `packages/game`.

## Constantes

| Nome | Valor |
| --- | --- |
| `MIN_SIZE` | 2 |
| `MAX_SIZE` | 14 |
| `DEFAULT_SIZE` | 5 |
| `MAX_PLAYERS` | 5 |
| `NICK_MIN` | 2 |
| `NICK_MAX` | 16 |
| `DISCONNECT_TO_BOT_MS` | 30000 |
| `TURN_TIMEOUT_MS` | 25000 |
| `BOT_THINK_MS` | 1000 |
| `RESULT_HOLD_MS` | 3000 |
| `LOBBY_POLL_MS` | 1000 |
| `ROOM_TTL_SECONDS` | 86400 |

Paleta de cores (ids estáveis):

1. `red`
2. `blue`
3. `green`
4. `yellow`
5. `purple`
6. `orange`
7. `teal`
8. `pink`

`BOT_NICKS` (sala, não o motor) — lista editável de **nomes** para bots. O nick na sala é sempre `Bot {nome}` (ex.: `Bot Jompes`). Sorteia um ainda livre (mesma chave de unicidade do nick humano, já com o prefixo). Esgotou: `Bot 1`, `Bot 2`, ….

```
Jompes, Babigol, Daniglover, Micles, Cayogre, Murrycuck, Gigi, Fipe, Pede-serra, Gilb rick, Beuberico, Xandon, Barco, Zuão, Tio Ita, Oliver, Teus, Jiow, Adilex, Bobô, Italiano, Nalbs, Wellbhs, Welcareca, Casca, Bigs, Tonts
```

Código da sala: 4 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

## Grade

A grade pode ser quadrada ou retangular.

`C` = quadrados na horizontal (largura). `R` = quadrados na vertical (altura). Inteiros em `[MIN_SIZE, MAX_SIZE]`.

Pontos: `(C + 1)` de largura × `(R + 1)` de altura.

Presets da UI:

- Quadradas: `C = R` em 2…10 (rótulo `N×N` em quadrados).
- Retangular: **10 pontos × 15 pontos** ⇒ `C = 9`, `R = 14` (126 quadrados).

- Arestas horizontais `H[r][c]`: `r ∈ [0, R+1)`, `c ∈ [0, C)`. Liga `(c, r)` → `(c+1, r)` em coordenadas (x, y) com y crescendo para baixo.
- Arestas verticais `V[r][c]`: `r ∈ [0, R)`, `c ∈ [0, C+1)`. Liga `(c, r)` → `(c, r+1)`.
- Quadrados `Q[r][c]`: `r ∈ [0, R)`, `c ∈ [0, C)`. Dono `null` ou `playerId`.

Uma aresta é um valor `{ orientation: "h" | "v", row: number, col: number }`.

Contagem de arestas: horizontais `(R + 1) * C`, verticais `R * (C + 1)`, total `C * (R + 1) + R * (C + 1)`.
Quadrados: `C * R`.

## Estado do jogo (`GameState`)

```
cols: C
rows: R
horizontal: (string | null)[][]   // (R+1) x C, playerId se desenhada
vertical: (string | null)[][]     // R x (C+1)
owners: (string | null)[][]  // R x C
playerIds: string[]       // ordem de turno, imutável após start
currentPlayerIndex: number
scores: Record<playerId, number>
status: "playing" | "finished"
winnerIds: string[]       // vazio enquanto playing
```

`turnDeadlineAt` mora na **sala** (não no `GameState`): epoch ms do fim desta vez. Humano: `now + TURN_TIMEOUT_MS`. Bot: `now + BOT_THINK_MS`. Sempre preenchido em `playing`; `null` em `lobby` / `finished`. `updatedAt` (snapshot público) é epoch ms da última mutação.

`createGame(cols, playerIds, rows = cols)` inicializa arestas e donos `null`, scores 0, `currentPlayerIndex = 0`, `status = "playing"`. A sala define o prazo no `start` e a cada lance.

`countEdgesByPlayer(state)` deriva, das grades `horizontal`/`vertical`, quantos traços cada `playerId` fez. Não mora no `GameState`. Timeout e lance normal incrementam igual (a aresta ganha dono).

## Jogada legal

`isLegalEdge(state, edge)` é verdadeiro somente se:

- `status === "playing"`
- índices dentro da grade
- a aresta ainda é `null`

## Aplicar jogada

`applyMove(state, playerId, edge) → { state, completedSquares }`

Pré-condições (erro de domínio, não muta):

- `playerId === playerIds[currentPlayerIndex]` senão `not_your_turn`
- `isLegalEdge` senão `illegal_move`

Efeitos:

1. Marca a aresta com o `playerId` de quem jogou.
2. Para cada quadrado adjacente que passou a ter os 4 lados, define `owners[r][c] = playerId` e incrementa `scores[playerId]`.
3. Um traço toca no máximo 2 quadrados.
4. Se `completedSquares.length === 0`, avança `currentPlayerIndex = (currentPlayerIndex + 1) % playerIds.length`. Se fechou 1 ou 2 quadrados, o índice **não** avança: quem jogou é obrigado a traçar de novo.
5. A sala redefine `turnDeadlineAt = now + TURN_TIMEOUT_MS` se a vez corrente for humana, ou `now + BOT_THINK_MS` se for bot (a mesma pessoa, se houve extra; ou a próxima).
6. Se não restam arestas `null`, `status = "finished"` e `winnerIds` = todos os `playerId` com score igual ao máximo.

O estado retornado é um novo objeto (imutável para o caller).

## Traço aleatório no timeout (`pickRandomMove`)

`pickRandomMove(state, random?) → edge` — uma aresta legal ao acaso (primeira da lista se `random` omitido, para testes).

Se o humano estoura `TURN_TIMEOUT_MS` sem `game:draw`, a sala aplica `applyMove` com `pickRandomMove` no `playerId` da vez. Há traço e possível ponto; a vez segue a regra de extra (fecha → joga de novo). O servidor emite `game:notice` (`timeout_draw`) para o toast.

## Bot

`pickBotMove(state, random?) → edge`

1. Lista arestas legais.
2. Se alguma completa pelo menos um quadrado, escolhe uma delas (primeira em ordem H depois V, varredura row-major — determinístico). Sempre fecha quando pode.
3. Senão pontua cada legal por quantos quadrados **abertos com 3 lados** o lance deixa (presente para o próximo). Prefere 0. Se todos deixam ≥ 1, escolhe o menor número.
4. Empate: aleatória entre as melhores (ou a primeira se `random` omitido).

O **servidor** (não o motor) espera **1 s cheio** (`BOT_THINK_MS`) **depois de publicar** a vez do bot, para o HUD e o tabuleiro atualizarem antes do lance. Não usa o tempo que “sobrou” no relógio (isso empilhava vários bots no mesmo frame). Extra (fechou quadrado): espera de novo 1 s.

## Tempo da vez

O relógio é da **sala** (`turnDeadlineAt` no snapshot). Corre na vez de humano **e** de bot.

- Humano: `TURN_TIMEOUT_MS` (25 s). Estourou sem `game:draw`: traço aleatório no nome de quem estava na vez; extra se fechar quadrado.
- Bot: `BOT_THINK_MS` (1 s) no snapshot, para o relógio. O lance sai do loop do servidor após 1 s (`pickBotMove`), não do timeout de traço aleatório.
- `game:draw` no prazo: aplica e reinicia o prazo da vez seguinte (ou da extra).
- Cliente atrasado: `game:draw` depois do prazo humano é ignorado.
- Relógio não corre no `lobby` nem em `finished`.

## Pausa antes do resultado

Quando `status` vira `finished`, o snapshot já tem o último quadrado. O **cliente** espera `RESULT_HOLD_MS` (3 s) na tela da partida e só então mostra o resultado. O servidor não atrasa o `finished`. Resume/F5 em sala já `finished` pula a pausa.

## Identidade (sala, não tabuleiro)

Normalizar nick: `trim`. Chave de unicidade: `normalizeNick(nick).toLocaleLowerCase("pt-BR")`.

Nick válido: comprimento do trim em `[2, 16]`, sem quebra de linha.

Cor válida: id ∈ paleta.

Dois assentos não compartilham a mesma chave de nick nem o mesmo `color`.

Preferência do aparelho (`localStorage` `tracinhos:identity`): último `{ nick, color }` com que a pessoa **entrou ou criou** com sucesso, e o último `{ cols, rows }` **selecionado** no lobby (mesmo sem criar). Não é token de assento; só preenche formulário.

## Máquina da sala

```
lobby --start (host, ≥2 players)--> playing
playing --sem arestas livres--> finished
finished --TTL--> (sala apagada)
```

Assento:

```
id, nick, color, kind: "human" | "bot",
connected: boolean,
disconnectedAt: number | null
```

Transições de assento:

- join (lobby): cria humano `connected=true`.
- addBot (lobby, host, < 5): cria bot com nick de `BOT_NICKS` (ou fallback) e primeira cor livre.
- disconnect: `connected=false`, `disconnectedAt=now`.
- após 30s desconectado: `kind="bot"` (mesmo id/nick/cor).
- resume com token válido: `kind="human"`, `connected=true`, `disconnectedAt=null`.

## Invariantes

- `playerIds.length` ∈ `[2, 5]` após start.
- Soma dos scores = número de quadrados com dono.
- Soma dos traços por jogador = número de arestas não `null`.
- Quadrado com dono tem os 4 lados com `playerId`.
- `finished` ⇔ zero arestas livres.
- Em `finished`, `winnerIds` não é vazio.
