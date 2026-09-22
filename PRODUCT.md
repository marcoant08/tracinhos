# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Amigos jogando no celular, numa sessão curta juntos: uma pessoa cria a sala, as outras entram com o código.

## Product Purpose

Tracinhos é uma partida multiplayer de ligar os pontos (dots and boxes) em sala com código, até 5 participantes (humanos e/ou bots), jogável no celular. Sucesso é completar uma partida no viewport alvo (~360×640), com F5 devolvendo o mesmo assento.

## Positioning

Sala por código, sem contas. Traço em dois toques no celular. O host adiciona bots e começa. Quem fecha um quadrado é obrigado a traçar de novo. Estouro de 40 s aplica um traço aleatório no nome de quem estava na vez.

## Operating Context

- Spec-driven: `specs/` é a autoridade do produto. Se código e spec divergirem, a spec vence até a spec ser atualizada de propósito.
- Constituição em `specs/constitution.md`. Feature atual em `specs/001-jogo-tracinhos/`.
- Produção: Vercel (Next.js) + Redis Upstash. Local: `npm run dev` → http://localhost:3000.
- Regras no servidor. Motor em `packages/game`. Tipos em `packages/shared`. UI em `apps/web`.

## Capabilities and Constraints

- Telas: `/` (criar/entrar), `/sala/:codigo` (join, lobby, playing, finished, gone), `/regras`.
- Criar/entrar com nick (2–16), cor da paleta de 8 ids, grade quadrada 2×2–10×10 ou 10×15 pontos (126 quadrados).
- Código da sala: 4 caracteres A–Z e 2–9, sem I/O/0/1.
- Máximo 5 assentos. Host inicia com pelo menos 2. Ordem de turno = ordem de assento.
- Identidade única na sala (nick sem diferenciar maiúsculas; cor da paleta). Depois de `playing`, nick e cor não mudam.
- Resume via `seatToken` no `localStorage`. Preferência do aparelho em `tracinhos:identity`.
- Humano tem 40 s por lance; bot pensa 1 s. Humano desconectado 30 s vira bot (mesmo nick/cor/id).
- Fora de escopo da v1: ranking persistente, chat, replay, contas, bot “esperto”, espectadores, liberar assento no meio da partida.
- Trabalho de design não inventa regras, vocabulário ou fluxos que contradigam a spec.

## Brand Commitments

- Nome: Tracinhos.
- Vocabulário da spec (pt-BR): sala, nick, traço, vez, host, bot, quadrados, código.
- Tagline em uso: “Ligue os pontos, feche os quadrados.” / “Ligue os pontos. Feche o quadrado. Jogue de novo.”
- Paleta de jogadores (ids estáveis): red, blue, green, yellow, purple, orange, teal, pink. Sem hex livre.
- Cor não é o único indicador de identidade ou da vez.
- Mundo visual: padrão da categoria (lobby de jogo com código), executado no ofício do Kahoot. Sem metáfora escolar, sem ironia, sem quirk contrabandeado.

## Evidence on Hand

- Specs: `specs/constitution.md`, `specs/001-jogo-tracinhos/{spec,domain,ui,plan,tasks}.md`, `specs/001-jogo-tracinhos/contracts/`.
- UI implementada em `apps/web` (lobby, sala, regras).
- Ícone: `apps/web/app/icon.svg`. Open Graph: `apps/web/app/opengraph-image.tsx`.
- Nicks de bot: lista `BOT_NICKS` em `specs/001-jogo-tracinhos/domain.md`.
- Sem depoimentos, casos de cliente, imprensa ou números de uso. Trabalho futuro não fabrica prova social.

## Product Principles

- A spec é a verdade do produto; design implementa, não reinterpreta regras.
- Mobile-first: o tabuleiro inteiro cabe na tela; o HUD permanece visível e com altura fixa; nada crítico depende de hover; toque ≥ 44px.
- Identidade e sessão sobrevivem a F5; a pessoa não re-entra como outra.
- A partida não trava: timeout, bots e desconexão avançam o jogo.
- Regras vivem no servidor; a UI mostra o snapshot, não inventa o lance.

## Accessibility & Inclusion

Requisitos da spec: cores não são o único indicador (nick sempre visível; vez com negrito + 👈 e `aria-current`); contraste dos traços sobre o papel; `aria-label` nas arestas; `aria-live` no contador (não a cada frame); área de toque ≥ 44px; viewport alvo ~360×640.
