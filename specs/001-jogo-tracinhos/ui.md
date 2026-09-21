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

**Placar:** em cada linha, **nick e pontos separados** — nick à esquerda (pode truncar), número de quadrados à direita (tabular / peso maior). Não colar `Marco 0`. Mesmo padrão no HUD e na tela de resultado.

## `/` Lobby

Coluna única:

1. Título “Tracinhos”.
2. Bloco **Criar**: stepper ou select `S` 2–10 (rótulo “N×N quadrados”, padrão 5×5), nick, grade de 8 cores, botão “Criar sala”.
3. Bloco **Entrar**: código (4 chars, auto-maiúsculo), nick, cores, botão “Entrar”.
4. Link **Regras** → `/regras`.

Cores ocupadas não se aplicam no criar (sala nova). No entrar, se o usuário já digitou código, buscar GET e desabilitar cores/nicks — ou ir direto a `/sala/:codigo` com o formulário lá. **Decisão:** o formulário completo de join mora em `/sala/:codigo`; o lobby só pede o código e navega.

## `/sala/:codigo`

Estados: `loading` | `join` | `lobby` | `playing` | `finished` | `gone`.

Layout da partida (`playing`): coluna `HUD (altura fixa)` + `tabuleiro (resto da viewport)`. O HUD **nunca** muda de altura quando o texto da vez ou o placar muda (reserva espaço para até `MAX_PLAYERS` chips). Assim o tabuleiro não salta.

### Join (sem sessão)

Nick + grade de cores. Cores ocupadas: círculo riscado, `aria-disabled`. Lista “Já na sala: Ana, Bia”. Botão **“Entrar”** (nunca “Sentar”).

### Lobby (com sessão, status lobby)

- Código grande + botão **“Copiar link”**: copia a URL absoluta da sala (`{origin}/sala/{codigo}`), não só o código. Toast curto “Link copiado”.
- Lista de jogadores (bolinha da cor **grande** + nick + host/bot).
- Host: “Adicionar bot”, “Começar” (desabilitado se < 2).
- Não-host: texto “Esperando o host…”.

### Playing

HUD fixo no topo (não rola com o tabuleiro), **altura constante**:

- Vez: “Vez de {nick}” + bolinha da cor **grande**. Se for você: destaque “Sua vez”.
- **Tempo (só vez humana):** número `{n}s` de 25 até 0. Ao redor, uma **borda/anel** 100% cheia em 25s e que **esvazia** de forma contínua até sumir em 0s. Bot na vez: sem esse contador (ou estado “pensando”, sem barra de 25s).
- Placar: uma linha por jogador — cor grande + nick (esquerda) + pontos (direita, separado). Altura do bloco de placar = 5 linhas (vagas vazias ocupam espaço / min-height).

Entre o placar e o tabuleiro, o mesmo vão que entre o indicador de vez (“Sua vez”) e os nomes.

Abaixo, viewport do tabuleiro:

- O tabuleiro **escala para caber** no espaço restante (largura e altura da viewport menos HUD e safe-area). **Todos os pontos visíveis o tempo todo.** Sem pan/zoom obrigatório; se sobrar espaço, o papel fica no topo, com o vão acima igual ao do HUD.
- Pontos grandes o bastante para o polegar (escalam com a célula). Traço feito em tinta escura, com um fio mais fino da cor de quem jogou por cima; quadrado preenchido na cor do dono com opacidade ~0.45. Traço livre é um fio bem fino (não é o alvo do toque).
- **Dois toques:** origem pisca em acento (`#c45c26`); destinos livres piscam em teal (`#1f8a8a`). Sem destino livre, o ponto não vira origem.
- Clique no segundo ponto válido envia `game:draw`. Traço já existente não é destino.
- Fora da vez, sem seleção e pontos não reagem a toque de jogada.
- Jogada ilegal ou fora da vez: toast no canto superior direito, sem avançar.
- Tempo esgotado: o tabuleiro ganha o traço aleatório e um toast anuncia (“Seu tempo acabou…” / “O tempo de {nick} acabou…”).

O cliente desenha o contador a partir de `turnDeadlineAt` no snapshot da sala (relógio do servidor), não de um timer local isolado.

### Finished

**Não** permanece no tabuleiro. Tela de **resultado**:

- Título “Fim de jogo”.
- Nome(s) do vencedor em destaque (cor + nick). Empate: “Empate” + os nicks destacados.
- Placar completo no mesmo layout (nick | pontos), vencedor(es) visualmente acima / com peso maior.
- Link ou botão “Nova sala” → `/`.

### gone

“Sala não encontrada” + link ao lobby.

### resumed_elsewhere

“Você abriu o jogo noutra aba.” Formulário não reaparece com o mesmo token até limpar.

## `/regras`

Página estática, mesma visual do lobby. Explica: objetivo, dois toques, **fechar quadrado obriga a traçar de novo** (sem fechar, a vez passa), 25 s, timeout = traço aleatório no nome de quem estava na vez (extra se fechar), bots, fim. Link de volta ao lobby.

## Acessibilidade mínima

Cores não são o único indicador: nick sempre visível. Contraste dos traços sobre o papel ≥ leitura comum. `aria-label` nas arestas (“traço horizontal linha 1 coluna 2”). Contador: `aria-live` com os segundos restantes (não a cada frame).
