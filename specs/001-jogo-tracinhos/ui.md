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

## `/` Lobby

Coluna única:

1. Título “Tracinhos”.
2. Bloco **Criar**: stepper ou select `S` 2–10 (rótulo “N×N quadrados”, padrão 5×5), nick, grade de 8 cores, botão “Criar sala”.
3. Bloco **Entrar**: código (4 chars, auto-maiúsculo), nick, cores, botão “Entrar”.

Cores ocupadas não se aplicam no criar (sala nova). No entrar, se o usuário já digitou código, buscar GET e desabilitar cores/nicks — ou ir direto a `/sala/:codigo` com o formulário lá. **Decisão:** o formulário completo de join mora em `/sala/:codigo`; o lobby só pede o código e navega.

Erro inline abaixo do campo/botão.

## `/sala/:codigo`

Estados: `loading` | `join` | `lobby` | `playing` | `finished` | `gone`.

### Join (sem sessão)

Nick + grade de cores. Cores ocupadas: círculo riscado, `aria-disabled`. Lista “Já na sala: Ana, Bia”. Botão “Sentar”.

### Lobby (com sessão, status lobby)

- Código grande + “Copiar”.
- Lista de assentos (bolinha da cor + nick + host/bot).
- Host: “Adicionar bot”, “Começar” (desabilitado se < 2).
- Não-host: texto “Esperando o host…”.

### Playing

HUD fixo no topo (não rola com o tabuleiro):

- Vez: “Vez de {nick}” + bolinha da cor. Se for você: destaque “Sua vez”.
- Placar: uma linha por jogador, cor + nick + pontos.

Abaixo, viewport do tabuleiro:

- Área com overflow hidden, pan (arrastar no vazio) e pinch-zoom (escala 0.6–3).
- Pontos grandes o bastante para o polegar. Traço feito em tinta escura, com um fio mais fino da cor de quem jogou por cima; quadrado preenchido na cor do dono com opacidade ~0.45. Traço livre é um fio bem fino (não é o alvo do toque).
- **Dois toques:** origem pisca em acento (`#c45c26`); destinos livres piscam em teal (`#1f8a8a`). Sem destino livre, o ponto não vira origem.
- Clique no segundo ponto válido envia `game:draw`. Traço já existente não é destino.
- Fora da vez, sem seleção e pontos não reagem a toque de jogada.
- Jogada ilegal ou fora da vez: toast curto, sem avançar.

### Finished

Mesmo tabuleiro (zoom resetável) + faixa “Venceu {nicks}” ou “Empate: …”. Placar final. Sem novo traço.

### gone

“Sala não encontrada” + link ao lobby.

### resumed_elsewhere

“Você abriu o jogo noutra aba.” Formulário não reaparece com o mesmo token até limpar.

## Acessibilidade mínima

Cores não são o único indicador: nick sempre visível. Contraste dos traços sobre o papel ≥ leitura comum. `aria-label` nas arestas (“traço horizontal linha 1 coluna 2”).
