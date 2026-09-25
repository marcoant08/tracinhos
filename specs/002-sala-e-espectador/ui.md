# UI — v2

Mesma base visual da [001/ui.md](../001-jogo-tracinhos/ui.md). Abaixo, só o que muda.

## Global

- **?:** botão circular, min 44×44, no header (home, sala, resultado). Abre sheet de baixo ou modal central com o texto de `/regras` + fechar. Fundo escurece; foco preso no sheet.
- **Desafio (topo):** barra fixa abaixo da safe-area, largura da coluna (`min(440px, 100%)`). Não é o toast da direita. Uma de cada vez. Empurra o conteúdo da home para baixo (não cobre o primeiro campo).
- **Caneta:** ícone único (SVG), `currentColor` = hex do jogador. No picker, fundo do botão some; a caneta é o alvo. Na vez, a caneta substitui a bolinha do bloco “Sua vez” / “Vez de”.

## `/` Home

Coluna única, ordem:

1. Header: título + **?**.
2. **Faixa de desafio** (se houver inbox pendente).
3. **Online:** lista. Vazio: “Ninguém online agora.” Cada livre: caneta + nick + botão “Desafiar”. Sem o próprio aparelho.
4. **Ao vivo:** lista de partidas `playing`. Vazio: “Nenhuma partida agora.” Linha: canetas/nicks, placar `a–b` (ou `a–b–c`), grade, `n/3`. Toque na linha inteira.
5. **Criar** e **Entrar** (como hoje; picker = canetas).
6. Sem link-texto “Regras”.

Online e ao vivo atualizam a cada `PRESENCE_POLL_MS` (3 s) com a aba visível. Desafio na faixa chega no mesmo GET.

## `/sala/:codigo`

### Código + ocupação (lobby e join)

- Código **grande** (≥ 2.4rem), centrado, `user-select` fácil. Toque copia as 4 letras.
- Abaixo ou ao lado: **`n/3`** (ex. `2/3`) em peso médio.
- “Copiar link” permanece, visualmente secundário.

### Sem sessão + `playing`

Formulário igual ao join: nick + canetas, pré-preenchidos. Título/código grandes. Botão **Assistir** (nunca “Entrar”). Cores já usadas por **outros espectadores** riscadas; nicks de jogadores e espectadores ocupados. **?** ok.

### Sem sessão + `finished`

Resultado direto (não pede nick). Sem olho.

### Sem sessão + `lobby`

Join como hoje + `n/3` + código grande + **?**. Botão **Entrar**.

### Lobby com sessão

Lista com `n/3`. Host: bot / starter / Começar. **?** no header. Sem link “Regras”.

### Playing (jogador ou espectador)

- Caneta no indicador de vez.
- Espectador: sem vinheta/borda de vez; pontos não selecionam; “Assistindo”.
- **Quem joga:** ícone de olho + número de espectadores no HUD (perto do código ou do `?`). Clique abre **balão** (`role="dialog"`) com os nicks (caneta + nome). Sem navegação. Clique fora fecha.
- **?** no HUD (não no meio do papel).
- Traço novo: cresce 280 ms; depois o quadrado.

### Finished

**?** + “Nova sala” / voltar. Espectador: sem “Nova sala” obrigatório; link home.

## Traço

1. Tinta `#2b2118` width **6**.
2. Cor do jogador width **5**, por cima, `round`.
3. Animação: `stroke-dashoffset` (ou equivalente) de 100% → 0 na direção origem→destino.

## Acessibilidade

Picker: `aria-label` da cor (nome, não só o hex). Desafiar: `aria-label` “Desafiar {nick}”. Olho: `aria-label` “{n} assistindo”. Sheet de regras e balão de espectadores: `role="dialog"`. Lista ao vivo: cada linha é um link/botão com os nicks no nome acessível.
