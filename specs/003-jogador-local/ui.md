# UI — jogador local

Mesma base da [002/ui.md](../002-sala-e-espectador/ui.md). Só o que muda.

## Lobby

- Host: **Adicionar bot** (igual) + **Adicionar jogador local**.
- Remoto que não é host: só **Adicionar jogador local** (sem bot, sem Começar).
- Sheet do local: título “Jogador local”, campo nick, `ColorPicker` (cores ocupadas riscadas), **Adicionar**. Toque ≥ 44px.
- Lista: `· host` / `· bot` / `· local` / `· remoto`. Host não mostra remoto.
- **Remover** na lista (bot, remoto ou local): só um ícone, sem o texto “Remover”. Toque ≥ 44px, `aria-label` “Remover {nick}”. Ícone quieto no tile (sem borda, sem chip, sem botão amarelo). O clique abre o mesmo diálogo de confirmação da v1.

## Partida (aparelho do dono)

- Vez do remoto dono: **Sua vez** + “Toque dois pontos vizinhos”.
- Vez do local deste aparelho: **Vez de {nick}** (Anton, papel) + hint Sora “Passe o celular”. Caneta na cor do local. Relógio 40 s.
- `prefers-reduced-motion`: o hint permanece; sem animação extra.

## Partida (outro aparelho)

Vez de um local de outra pessoa: “Vez de {nick}”, sem “Passe o celular”, sem toque.
