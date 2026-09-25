# Tasks — v2

Cada item só é “feito” se o aceite da spec correspondente passar.

## 1. Contratos e constantes

- [x] `MAX_PLAYERS = 3` em game + shared + recusa `room_full` no 4º.
- [x] Tipos e erros: `challenge_*`, presença, `LiveRoom`.
- [x] REST `/api/lobby`, `/api/challenges`, ping.

## 2. Sala (3 jogadores, código, n/3, ?)

- [x] Lobby/join/HUD: `{n}/3`.
- [x] Código grande; toque copia o código; link continua.
- [x] Botão **?** + sheet das regras em home, sala e resultado.

## 3. Caneta e traço

- [x] Caneta no color picker e no indicador de vez.
- [x] Overlay colorido ~5 de espessura.
- [x] Animação 280 ms origem→destino; remoto canônico; F5 sem reanimar; quadrado depois.

## 4. Espectador + ao vivo

- [x] `playing` sem token: formulário nick/cor + **Assistir** (`watchToken`).
- [x] HUD de quem joga: olho + número; clique abre balão com nicks.
- [x] `live:rooms` no start/fim; lista na home; toque cai no formulário Assistir se ainda não tiver token.

## 5. Online + desafio

- [x] `tracinhos:presence` + ping na home visível a cada `PRESENCE_POLL_MS` (3 s).
- [x] Lista online (sem você; sem seated).
- [x] Desafiar → faixa no topo do alvo; aceitar senta os dois; recusar/expirar 30 s.
