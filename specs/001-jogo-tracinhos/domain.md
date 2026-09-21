# Domínio — regras do Jogo dos Tracinhos

Motor puro. Sem I/O. Implementação: `packages/game`.

## Constantes

| Nome | Valor |
| --- | --- |
| `MIN_SIZE` | 2 |
| `MAX_SIZE` | 10 |
| `DEFAULT_SIZE` | 5 |
| `MAX_PLAYERS` | 5 |
| `NICK_MIN` | 2 |
| `NICK_MAX` | 16 |
| `DISCONNECT_TO_BOT_MS` | 30000 |
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

Código da sala: 4 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

## Grade

`S` = quadrados por lado, inteiro em `[MIN_SIZE, MAX_SIZE]`.

`N = S + 1` (pontos por lado).

- Arestas horizontais `H[r][c]`: `r ∈ [0, N)`, `c ∈ [0, S)`. Liga `(c, r)` → `(c+1, r)` em coordenadas (x, y) com y crescendo para baixo.
- Arestas verticais `V[r][c]`: `r ∈ [0, S)`, `c ∈ [0, N)`. Liga `(c, r)` → `(c, r+1)`.
- Quadrados `Q[r][c]`: `r,c ∈ [0, S)`. Dono `null` ou `playerId`.

Uma aresta é um valor `{ orientation: "h" | "v", row: number, col: number }`.

Contagem de arestas: `H = N * S`, `V = S * N`, total `2 * S * (S + 1)`.
Quadrados: `S * S` (máximo 100).

## Estado do jogo (`GameState`)

```
size: S
horizontal: (string | null)[][]   // N x S, playerId se desenhada
vertical: (string | null)[][]     // S x N
owners: (string | null)[][]  // S x S
playerIds: string[]       // ordem de turno, imutável após start
currentPlayerIndex: number
scores: Record<playerId, number>
status: "playing" | "finished"
winnerIds: string[]       // vazio enquanto playing
```

`createGame(size, playerIds)` inicializa arestas e donos `null`, scores 0, `currentPlayerIndex = 0`, `status = "playing"`.

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
4. Se `completedSquares.length > 0`, **não** avança o índice (jogada extra, uma só, mesmo fechando 2).
5. Se nenhum quadrado fechou, `currentPlayerIndex = (currentPlayerIndex + 1) % playerIds.length`.
6. Se não restam arestas `null`, `status = "finished"` e `winnerIds` = todos os `playerId` com score igual ao máximo.

O estado retornado é um novo objeto (imutável para o caller).

## Bot guloso

`pickBotMove(state, random?) → edge`

1. Lista arestas legais.
2. Se alguma completa pelo menos um quadrado, escolhe uma delas (primeira em ordem H depois V, varredura row-major — determinístico se `random` omitido; testes usam essa ordem).
3. Senão escolhe aleatória (ou a primeira se `random` omitido, para testes).

## Identidade (sala, não tabuleiro)

Normalizar nick: `trim`. Chave de unicidade: `normalizeNick(nick).toLocaleLowerCase("pt-BR")`.

Nick válido: comprimento do trim em `[2, 16]`, sem quebra de linha.

Cor válida: id ∈ paleta.

Dois assentos não compartilham a mesma chave de nick nem o mesmo `color`.

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
- addBot (lobby, host): cria bot.
- disconnect: `connected=false`, `disconnectedAt=now`.
- após 30s desconectado: `kind="bot"` (mesmo id/nick/cor).
- resume com token válido: `kind="human"`, `connected=true`, `disconnectedAt=null`.

## Invariantes

- `playerIds.length` ∈ `[2, 5]` após start.
- Soma dos scores = número de quadrados com dono.
- Quadrado com dono tem os 4 lados com `playerId`.
- `finished` ⇔ zero arestas livres.
- Em `finished`, `winnerIds` não é vazio.
