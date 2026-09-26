# Plano técnico — v3

Implementa [spec.md](spec.md).

## O que muda

- `packages/shared`: `PlayerKind = "remote" | "local" | "bot"`; `ownerPlayerId` no `PublicPlayer`; `room:addLocal`.
- `apps/web/lib/rooms.ts`: `addLocal`; draw autoriza dono; sweep/promote converte locais do dono; normaliza `human` → `remote`.
- `apps/web`: sheet no lobby; hint “Passe o celular”; `canDraw` na vez do local deste aparelho.

## ADR 11 — Local sem token

O local não ganha `seatToken`. O token do remoto dono já autentica o aparelho. Um segundo token no `localStorage` duplicaria F5 e “Sua partida” sem ganho.

## ADR 12 — `human` vira `remote`

A flag que o produto pediu é remoto/local/bot + host. `human` misturava host e quem entrou de fora. Persistência antiga mapeia `human` → `remote` na leitura.

## Riscos

- Draw no isolate: o POST já manda só `seatToken`+`edge`; o servidor usa a vez atual, não um `playerId` do cliente.
- Dono vira bot no meio da vez do local: o relógio passa a `BOT_THINK_MS` e o servidor joga.
