# UI — v2

Mesma base visual da [001/ui.md](../001-jogo-tracinhos/ui.md). Abaixo, só o que muda.

## Global

- **?:** botão circular, min 44×44, no header (home, sala, resultado). Abre sheet de baixo ou modal central com o texto de `/regras` + fechar. Fundo escurece; foco preso no sheet.
- **Desafio (topo):** balão `position: fixed` no topo, como toast (não empurra o conteúdo). Largura `min(440px, 100% − 24px)`. Anel de tempo igual ao da partida, sem número, ~44px, 15 s (`CHALLENGE_TTL_MS`). Uma de cada vez.
- **Caneta:** ícone único (lápis Phosphor em preenchimento), `currentColor` = hex do jogador. No picker, ao selecionar a cor a caneta sai do centro, vai ao início do tracinho (~280 ms) e o desenha da esquerda para a direita (~560 ms). A cor anterior devolve a caneta ao centro (~280 ms) e some o traço. Sem movimento se `prefers-reduced-motion`. Na vez, a caneta substitui a bolinha do bloco “Sua vez” / “Vez de”.

## `/` Home

Coluna única, ordem:

1. Header: título + **?**.
2. **Faixa de desafio** (se houver inbox pendente).
3. **Online:** lista. Vazio: “Ninguém online agora.” Cada livre: caneta + nick + botão “Desafiar”. Em partida: mesmo nick + botão “Jogando” desabilitado, cinza. Sem o próprio aparelho. Mais de 5 nomes: a lista rola.
4. **Ao vivo:** lista de partidas `playing`. Vazio: “Nenhuma partida agora.” Linha: canetas/nicks, placar `a–b` (ou `a–b–c`), grade, `n/3`. Se for a sua (tem `seatToken`): anel amarelo + “Sua partida”, no topo da lista. Toque na linha inteira. Mais de 5 partidas: a lista rola.
5. **Criar** e **Entrar** (como hoje; picker = canetas).
6. Sem link-texto “Regras”.

Online e ao vivo atualizam a cada `PRESENCE_POLL_MS` (3 s) com a aba visível. Desafio na faixa chega no mesmo GET. Desafiar alguém que já saiu: toast “Essa pessoa não está mais online.” — nunca “Desafio enviado.”

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
- **Quem joga:** ícone de olho + número **só com alguém assistindo**. Clique abre **balão** (`role="dialog"`) com os nicks (caneta + nome). Sem navegação. Clique fora fecha.
- **?** no HUD (não no meio do papel).
- Traço novo: cresce 280 ms; depois o quadrado.

### Finished

**?** + “Nova sala” / voltar. Espectador: sem “Nova sala” obrigatório; link home.

## Traço

1. Tinta `#2b2118` width **6**.
2. Cor do jogador width **5**, por cima, `round`.
3. Animação: `stroke-dashoffset` (ou equivalente) de 100% → 0 na direção origem→destino.

## Acessibilidade

Picker: `aria-label` da cor (nome, não só o hex). Desafiar: `aria-label` “Desafiar {nick}”. Em partida: `aria-label` “{nick} está jogando”. Olho: `aria-label` “{n} assistindo”. Sheet de regras e balão de espectadores: `role="dialog"`. Lista ao vivo: cada linha é um link/botão com os nicks no nome acessível.
