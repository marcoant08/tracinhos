# Spec — Jogador local (v3)

Incremento sobre [002](../002-sala-e-espectador/spec.md). O que esta spec muda, vence a v2.

Um **jogador local** está do lado de quem já tem assento neste aparelho. Não abre outra aba nem outro celular: depois da sua vez, a pessoa passa o telefone.

A UI nunca diz “assento”. Flags visíveis: **host**, **bot**, **local**, **remoto**.

## Atores (novos)

- **Remoto**: humano com `seatToken` neste aparelho. É quem criou a sala ou entrou pelo formulário. Substitui o `kind: "human"` da v1.
- **Local**: humano sem `seatToken`. Vive no mesmo aparelho de um remoto (`ownerPlayerId`). O remoto traça por ele quando for a vez.

**Host** continua sendo o `hostPlayerId` (sempre um remoto). **Bot** não muda.

## Histórias e aceite

### 1. Adicionar local no lobby

No lobby, quem já está sentado neste aparelho (host ou quem entrou) pode adicionar um jogador local enquanto houver vaga.

**Aceite**

- Botão **Adicionar jogador local** (além de **Adicionar bot**). Desabilitado se `players.length ≥ MAX_PLAYERS` (3).
- Abre um sheet: nick (2–16) + grade de cores livres + **Adicionar**. Cancela no fundo/X.
- Nick e cor únicos na sala (mesmo critério de join). Recusas: `invalid_nick`, `invalid_color`, `nick_taken`, `color_taken`, `room_full`, `game_already_started`.
- Só o remoto deste aparelho adiciona locais **nele**. Bot e local não adicionam ninguém.
- O local entra na lista com `· local`. Pode ser escolhido em “Quem começa”.
- Host (e o dono) podem remover o local. Sem `seatToken` para invalidar.
- Em toda a lista do lobby, **Remover** vira só um ícone (sem rótulo visível). Confirmação igual à v1.

### 2. Passar o celular na vez

Na partida, o aparelho do dono aceita o traço do local. Os outros aparelhos só veem.

**Aceite**

- Vez do **remoto deste aparelho**: “Sua vez” como hoje (40 s).
- Vez de um **local deste aparelho**: “Vez de {nick}” + hint “Passe o celular”. Relógio de 40 s. Pontos aceitam toque.
- Vez de outra pessoa: “Vez de {nick}” (bot: “pensando…”). Sem toque.
- F5 no aparelho do dono: o `seatToken` volta; os locais continuam na sala. Sem token novo.
- Lista Online / desafio: local **não** aparece. No Ao vivo, o nick entra na linha da partida.

### 3. Flags e desconexão

**Aceite**

- Snapshot público: `kind: "remote" | "local" | "bot"` e, se local, `ownerPlayerId`.
- Sufixos na lista: `· host` / `· bot` / `· local` / `· remoto` (host não leva “remoto”).
- Sala antiga no Redis com `kind: "human"` lê como `"remote"`.
- Se o remoto dono some 30 s e vira bot, **os locais dele também viram bot** (mesmo nick/cor/id). Sem o telefone, ninguém joga no lugar.

## Fora de escopo

Local com aparelho próprio, local adicionar outro local, local depois que a partida começou, presença/desafio por local.
