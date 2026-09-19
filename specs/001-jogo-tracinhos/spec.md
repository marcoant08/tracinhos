# Spec — Jogo dos Tracinhos (v1)

Produto: partida multiplayer de ligar pontos (dots and boxes) em sala com código, até 5 participantes (humanos e/ou bots), jogável no celular.

Referências: [domain.md](domain.md), [ui.md](ui.md), [contracts/](contracts/).

## Atores

- **Visitante**: ainda não sentou.
- **Jogador**: humano com assento (nick, cor, `playerId`, `seatToken`).
- **Host**: primeiro jogador da sala; pode adicionar bots e iniciar.
- **Bot**: assento controlado pelo servidor.

## Histórias e aceite

### 1. Criar sala

O visitante escolhe tamanho da grade (`S` de 2 a 10, padrão 5), nick e cor, e cria a sala.

**Aceite**

- Recebe um código curto (4 caracteres A–Z e 2–9, sem I/O/0/1).
- É redirecionado para `/sala/:codigo` já sentado como host.
- Sessão `{ playerId, seatToken, nick, color, roomCode }` é persistida no `localStorage`.
- Sem nick válido ou cor da paleta, a sala não é criada.

### 2. Entrar na sala

O visitante informa o código, escolhe nick e cor ainda livres.

**Aceite**

- A tela mostra nicks já na sala e desabilita cores ocupadas (atualização ao vivo).
- Servidor recusa `nick_taken` ou `color_taken` (nick comparado sem maiúsculas).
- Sala cheia (5 assentos) recusa `room_full`.
- Partida já iniciada recusa novo join (`game_already_started`), exceto resume.
- Código inexistente: `room_not_found`.

### 3. Identidade única

Nick: 2–16 caracteres após trim. `Ana` e `ana` colidem. Exibição usa o texto digitado.

Cor: uma das 8 cores da paleta. Sem hex livre.

Bots: nick `Bot 1`, `Bot 2`, … e a primeira cor livre. Host não escolhe cor do bot.

Depois de `playing`, nick e cor não mudam.

### 4. F5 / resume

Reload em `/sala/:codigo` reconecta no mesmo assento.

**Aceite**

- Com sessão válida, não pede nick/cor de novo.
- Mesmo `playerId`, nick e cor.
- Vale no lobby, durante o jogo e no resultado.
- Token inválido ou sala sumiu: limpa storage e mostra o formulário.
- Segunda aba com o mesmo token: a mais recente fica; a antiga recebe `resumed_elsewhere` e para.

### 5. Lobby da sala

Host adiciona bots (até o limite de 5) e inicia com pelo menos 2 participantes.

**Aceite**

- Não-host não inicia nem adiciona bot (`not_host`).
- Com 1 participante, iniciar falha (`not_enough_players`).
- Ao iniciar, status vira `playing` e todos recebem o snapshot do tabuleiro vazio.
- Ordem dos turnos = ordem de assento (join / bots na sequência em que entraram).

### 6. Jogar

Na vez, o jogador desenha um traço horizontal ou vertical entre pontos vizinhos.

**Aceite**

- Traço já desenhado, diagonal, ou fora da grade: `illegal_move`.
- Jogada fora da vez: `not_your_turn`.
- Fechar 1 quadrado: marca com a cor do jogador, +1 ponto, mesma pessoa joga de novo.
- Fechar 2 quadrados no mesmo traço: marca os dois, +2, **uma** jogada extra.
- Sem fechar: a vez passa ao próximo (pulando quem não está na lista de turnos).
- Bot na vez: o servidor joga automaticamente (guloso: fecha se puder; senão aleatório).

### 7. Fim

Quando não restam arestas livres, a partida termina.

**Aceite**

- Vence quem tem mais quadrados.
- Empate: todos com a pontuação máxima empatada são vencedores.
- Snapshot `finished` + lista de `winnerIds`.
- Placar mostra nick + cor + pontos.

### 8. Desconexão

Humano some: a partida não trava.

**Aceite**

- Após 30s desconectado, o assento vira bot (mantém nick/cor/`playerId`).
- Se for a vez dele, o bot joga.
- Resume no prazo devolve `kind: human` ao dono do token.

### 9. Mobile

Fluxo completo cabe e é usável em ~360×640.

**Aceite**

- Botões e seletor de cor com área de toque ≥ 44px.
- HUD (vez, placar, “sua vez”) permanece visível com grade 10×10.
- Grade grande: pan e pinch-zoom; dá para acertar um traço sem o vizinho.
- Sem ação essencial só no hover.

## Fora de escopo

Contas, ranking, chat, replay, dificuldade de bot, espectadores, sair da sala no meio para liberar o assento a outra pessoa (v1 o assento permanece até a sala expirar).
