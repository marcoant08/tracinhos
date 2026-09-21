# UI — mobile-first

Alvo: 360×640. Safe-area nas bordas. Toque ≥ 44px. Sem hover obrigatório.

## Visual

Fundo escuro quente (`#1a1410`), papel (`#f4e8d4`), tinta (`#2b2118`), acento (`#c45c26`). Tipografia sem serifa geométrica. Traços do tabuleiro grossos o bastante para leitura no celular.

Paleta de jogadores (hex de tela, ids iguais ao domínio):

| id | hex |
| --- | --- |
| red | `#d64545` |
| blue | `#2f6fed` |
| green | `#2f9e5f` |
| yellow | `#d4a017` |
| purple | `#7b4fc7` |
| orange | `#e06b20` |
| teal | `#1f8a8a` |
| pink | `#d4539b` |

## Feedback global

**Erros:** toast no **canto superior direito** (todas as telas: lobby, join, sala). Uma linha, some sozinho ~2,2s. Não empurra o layout. Vários erros: substitui o anterior.

**Identidade na UI:** bolinha da cor **maior** que o texto ao lado (≥ 14px de diâmetro no HUD/listas; ≥ 18px na tela de resultado). Contraste visível sobre o fundo escuro.

**Placar:** em cada linha, **nick e números separados** — nick à esquerda (pode truncar); à direita **dois contadores tabulares**: quadrados (`scores`) e traços (arestas com aquele `playerId`). Não colar `Marco 0`. Sufixos curtos `□` e `─` (com `aria-label` “quadrados” / “traços”). Mesmo padrão no HUD e na tela de resultado. Vencer continua sendo por quadrados.

## `/` Lobby

Coluna única:

1. Título “Tracinhos”.
2. Bloco **Criar**: select `S` 2–10 **grande** (min-height **56px**, fonte ≥ **1.15rem**, largura total do card; rótulo “N×N quadrados”, padrão 5×5), nick, grade de 8 cores, botão “Criar sala”.
3. Bloco **Entrar**: código (4 chars, auto-maiúsculo), botão “Entrar”.
4. Link **Regras** → `/regras`.

Nick e cor do criar (e do join em `/sala/:codigo`) abrem já preenchidos com `tracinhos:identity` se existir. Gravados de novo após criar/entrar com sucesso.

Cores ocupadas não se aplicam no criar (sala nova). No entrar, se o usuário já digitou código, buscar GET e desabilitar cores/nicks — ou ir direto a `/sala/:codigo` com o formulário lá. **Decisão:** o formulário completo de join mora em `/sala/:codigo`; o lobby só pede o código e navega.

## `/sala/:codigo`

Estados: `loading` | `join` | `lobby` | `playing` | `finished` | `gone`.

Layout da partida (`playing`): coluna `HUD (altura fixa)` + `tabuleiro (resto da viewport)`. O HUD **nunca** muda de altura quando o texto da vez ou o placar muda (reserva espaço para até `MAX_PLAYERS` chips). Assim o tabuleiro não salta.

### Join (sem sessão)

Nick + grade de cores, **pré-preenchidos** com `tracinhos:identity` se houver. Cores ocupadas: círculo riscado, `aria-disabled`. Lista “Já na sala: Ana, Bia” (ao vivo, mesmo GET de 1 s). Botão **“Entrar”** (nunca “Sentar”). Join com sucesso grava de novo a preferência.

### Lobby (com sessão, status lobby)

- Código grande + botão **“Copiar link”**: copia a URL absoluta da sala (`{origin}/sala/{codigo}`), não só o código. Toast curto “Link copiado”.
- Lista de jogadores (bolinha da cor **grande** + nick + host/bot). Atualiza sozinha quando alguém entra (WS e, **só no lobby**, GET a cada `LOBBY_POLL_MS` / 1 s). Na partida não há poll contínuo.
- Host: “Adicionar bot” (desabilitado se `players.length === MAX_PLAYERS`), “Começar” (desabilitado se < 2).
- Não-host: texto “Esperando o host…”.

### Playing

HUD fixo no topo (não rola com o tabuleiro), **altura constante**:

- Vez: “Vez de {nick}” + bolinha da cor **grande**. Se for você: destaque “Sua vez”.
- **Tempo (humano e bot):** número `{n}s` + **borda/anel**. Humano: 25s cheio → 0. Bot: 1s cheio → 0 (`BOT_THINK_MS`). Sempre visível enquanto `playing` e há `turnDeadlineAt`. Cada lance de bot só sai **depois** de 1 s com o snapshot já na tela (nome no HUD + traço anterior visível); nunca empilha 2–3 bots no mesmo frame.
- Placar: uma linha por jogador — cor grande + nick (esquerda) + **quadrados `□` e traços `─`** (direita, separados). Quem está na vez: nick **negrito** e `👈` imediatamente após o nome (ex.: `Marco 👈`). As outras linhas iguais. Altura do bloco de placar não salta.

Entre o placar e o tabuleiro, o mesmo vão que entre o indicador de vez (“Sua vez”) e os nomes.

Abaixo, viewport do tabuleiro:

- O tabuleiro **escala para caber** no espaço restante (largura e altura da viewport menos HUD e safe-area). **Todos os pontos visíveis o tempo todo.** Sem pan/zoom obrigatório; se sobrar espaço, o papel fica no topo, com o vão acima igual ao do HUD.
- **Vinheta no papel** (bordas internas do SVG/área da grade, não o fundo da página): cor forte na borda, some em direção ao centro (radial). **Acende e apaga uma vez** em ~1 s — o papel volta ao normal. Dispara ao **entrar** em cada estado, não fica ligada o turno inteiro. **Verde** (`#2f9e5f`) ao começar a sua vez com mais de 10 s. **Laranja** (`#e06b20`) quando a vez humana **passa a ter ≤ 10 s**. **Vermelho** (`#d64545`) quando **passa a ter ≤ 5 s**. Uma de cada vez (vermelho substitui laranja, etc.). Vez de outra pessoa ou de bot: sem verde. Sem empurrar layout.
- Pontos grandes o bastante para o polegar (escalam com a célula). Traço feito em tinta escura, com um fio mais fino da cor de quem jogou por cima; quadrado preenchido na cor do dono com opacidade ~0.45. Traço livre é um fio bem fino (não é o alvo do toque).
- **Dois toques:** origem pisca em acento (`#c45c26`); destinos livres piscam em teal (`#1f8a8a`). Sem destino livre, o ponto não vira origem.
- Clique no segundo ponto válido pinta o traço **na hora** (e o quadrado, se fechou) e envia `game:draw`. O traço local **fica** até o snapshot confirmar; se o servidor rejeitar só o último lance em voo, esse some. Sem fechar: não aceita outro clique até confirmar (evita o traço sumir). Extra: dá para traçar de novo sem esperar o round-trip. Traço já existente não é destino.
- Fora da vez (pelo snapshot do servidor), sem seleção e pontos não reagem a toque de jogada. O HUD “Sua vez” / “Vez de X” segue o servidor, não o traço otimista — assim um WS atrasado não trava o clique na vez certa.
- Jogada ilegal ou fora da vez: toast no canto superior direito, sem avançar.
- Tempo esgotado: o tabuleiro ganha o traço aleatório e um toast anuncia (“Seu tempo acabou…” / “O tempo de {nick} acabou…”).

O cliente desenha o contador a partir de `turnDeadlineAt` no snapshot da sala (relógio do servidor), não de um timer local isolado. A duração do anel é `TURN_TIMEOUT_MS` se a vez for humana e `BOT_THINK_MS` se for bot.

Quando o snapshot chega `finished`, a UI **permanece na partida 3 s** (`RESULT_HOLD_MS`) com o tabuleiro final (último quadrado visível, sem aceitar lance). Depois abre a tela de resultado. F5 em sala já terminada: resultado na hora.

### Finished

**Não** permanece no tabuleiro depois da pausa. Tela de **resultado**:

- Título “Fim de jogo”.
- Nome(s) do vencedor em destaque (cor + nick). Empate: “Empate” + os nicks destacados.
- Placar completo no mesmo layout (nick | quadrados `□` | traços `─`), vencedor(es) visualmente acima / com peso maior.
- Link ou botão “Nova sala” → `/`.

### gone

“Sala não encontrada” + link ao lobby.

### resumed_elsewhere

“Você abriu o jogo noutra aba.” Formulário não reaparece com o mesmo token até limpar.

## `/regras`

Página estática, mesma visual do lobby. Explica: objetivo, dois toques, **fechar quadrado obriga a traçar de novo** (sem fechar, a vez passa), 25 s, timeout = traço aleatório no nome de quem estava na vez (extra se fechar), bots pensam **1 s**, fim. Link de volta ao lobby.

## Acessibilidade mínima

Cores não são o único indicador: nick sempre visível; a vez também tem negrito + `👈` (e `aria-current="true"` na linha). Contraste dos traços sobre o papel ≥ leitura comum. `aria-label` nas arestas (“traço horizontal linha 1 coluna 2”). Contador: `aria-live` com os segundos restantes (não a cada frame). Vinheta da vez não é o único sinal (relógio e HUD continuam).
