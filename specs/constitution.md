# Constituição — Jogo dos Tracinhos

Princípios permanentes da v1. Mudar um item aqui é uma decisão de produto, não um atalho de implementação.

## Spec first

- Histórias, regras e contratos existem antes do código da feature.
- Testes automatizados do motor citam o comportamento de `domain.md`.
- Tipos em `packages/shared` espelham os contratos, não o contrário.

## Regras só no servidor

- O cliente envia intenção (`drawEdge`, join, resume). O servidor valida, aplica e devolve snapshot.
- O motor em `packages/game` não importa React, Next, Redis nem WebSocket.

## Estado compartilhado fora do processo

- Salas, presença e tabuleiro vivem no Redis.
- Variável de módulo não é fonte da verdade (Vercel tem várias instâncias).

## Sessão sobrevive a reload

- F5 não é um join novo. O mesmo `playerId`, nick e cor voltam via `seatToken`.
- Sem o token, ninguém reivindica o assento.

## Identidade na sala

- Nick e cor são obrigatórios para entrar na sala.
- Nick e cor são únicos por sala (nick sem diferenciar maiúsculas).
- Cor só da paleta fixa. Depois que a partida começa, identidade não muda.

## Mobile-first

- Viewport alvo ~360×640. Desktop é ampliação.
- Nada crítico depende de hover.
- Na partida, o tabuleiro inteiro (todos os pontos) cabe na tela; o HUD não some e não muda de altura.

## Deploy

- Produção: Vercel (um projeto Next.js) + Redis (Upstash REST).
- Local: `npm run dev`. Redis via `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
- WebSocket nativo, não Socket.IO.

## Fora de escopo até nova spec

Ranking persistente, chat, replay, contas de usuário, bot “esperto”.
