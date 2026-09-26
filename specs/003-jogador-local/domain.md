# Domínio — jogador local

Complementa [001/domain.md](../001-jogo-tracinhos/domain.md) e [002/domain.md](../002-sala-e-espectador/domain.md).

## Assento

```
id, nick, color,
kind: "remote" | "local" | "bot",
ownerPlayerId: string | null,  // obrigatório e = id de um remote da sala se kind=local; senão null
connected, disconnectedAt, wsEpoch
```

`human` deixa de existir. Persistido como `human` → carrega `remote`.

O **host** é o `hostPlayerId` (sempre `kind=remote`). Não é um `kind`.

Flags da UI (derivadas):

| Flag | Quando |
| --- | --- |
| host | `id === hostPlayerId` |
| bot | `kind === "bot"` |
| local | `kind === "local"` |
| remoto | `kind === "remote"` e não é host |

## Comandos novos

- **addLocal** (lobby): ator é `remote` da sala; `players.length < MAX_PLAYERS`; nick/cor válidos e livres. Cria assento `kind=local`, `ownerPlayerId=ator`, `connected=true`, `wsEpoch=0`. Sem `seatToken`.
- **removePlayer**: host remove qualquer um menos a si; um remote remove só os locais com `ownerPlayerId` dele. Local nunca tem token para limpar.

## Lance

`game:draw` / POST draw com o `seatToken` do **dono**:

- vez do próprio remoto, ou
- vez de um local com `ownerPlayerId` igual ao dono do token.

Senão `not_your_turn`. Timeout de local = `TURN_TIMEOUT_MS` (40 s), não o do bot.

## Presença do assento

- Local **não** tem WS próprio. `connected` copia o do dono (ou fica `true` enquanto o dono estiver `remote` e conectado).
- GET/draw/resume do dono: presença só no remoto (`kind=remote`, `connected=true`).
- Disconnect 30 s no dono: `kind=bot` nele **e** em todo local com esse `ownerPlayerId`.
- Resume do dono: ele volta `remote`; locais que ainda forem `local` (não viraram bot) seguem.

## Invariantes

- `ownerPlayerId` só preenchido se `kind=local`.
- O dono existe na sala e é `remote` (ou virou `bot` depois).
- Local nunca tem `seat:{token}`.
- Soma de assentos continua ≤ 3.
