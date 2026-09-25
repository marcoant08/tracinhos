# Spec — Sala, presença e espectador (v2)

Incremento sobre [001](../001-jogo-tracinhos/spec.md). O que esta spec muda, vence a v1.

Sem contas de usuário. Presença e desafio usam um `presenceToken` do aparelho. Internamente continua `seat` / `seatToken`; a UI nunca diz “assento”.

## Atores (novos)

- **Visitante**: na home ou numa sala sem sessão de jogador nem de espectador.
- **Espectador**: escolheu nick/cor e assiste (`watchToken`). Vê o tabuleiro; não joga. Não ocupa `{n}/3`.
- **Presença**: aparelho com nick válido e heartbeat recente na home. Aparece na lista “online”.

## Histórias e aceite

### 1. No máximo 3 na sala

`MAX_PLAYERS` passa a **3** (humanos e/ou bots).

**Aceite**

- Join e “Adicionar bot” recusam o 4º (`room_full`).
- Motor recusa `createGame` com mais de 3 `playerIds`.
- Lobby, join e HUD mostram `{n}/3` (n = `players.length`).
- Começar ainda exige pelo menos 2.

### 2. Código da sala óbvio

No lobby (e no join, se já houver código na URL), o código de 4 letras é o elemento mais visível depois do título.

**Aceite**

- Tipo ≥ **2.4rem**, tracking largo, fácil de ler e ditar.
- Toque no código **copia o código** (as 4 letras). Toast “Código copiado”.
- “Copiar link” continua copiando `{origin}/sala/{codigo}`.
- `{n}/3` aparece perto da lista ou do código.

### 3. Interrogação = regras

Um botão **?** (≥ 44px) abre as regras **sem sair da tela** (sheet/modal com o mesmo conteúdo de `/regras`).

**Aceite**

- Presente na home, join, lobby, partida (jogador e espectador) e resultado.
- Substitui o link-texto “Regras” nessas telas. `/regras` continua existindo (deep link / F5).
- Fecha no X, no fundo ou em Escape. Não empurra o tabuleiro de forma permanente.
- Na partida o `?` não compete com o relógio (canto do header/HUD).

### 4. Caneta da cor do jogador

A cor deixa de ser só uma bolinha na **escolha de cor** e no **indicador de vez**.

**Aceite**

- Color picker: cada opção é uma **caneta** na cor da paleta (não um círculo chapado). Selecionada = evidência clara (anel/fundo). Ocupada = riscada, `aria-disabled`.
- HUD da vez: caneta na cor de quem está na vez + “Sua vez” / “Vez de {nick}”. Espectador: mesma caneta, nunca “Sua vez”.
- Placar e resultado podem manter a bolinha. Cor nunca é o único sinal (nick + `👈` / `aria-current`).

### 5. Traço colorido mais grosso

O fio da cor do jogador (por cima da tinta) fica **bem mais próximo** da espessura da tinta.

**Aceite**

- Tinta escura permanece a base (~6).
- Overlay da cor: de ~2.5 para **~5** (mesma unidade do SVG atual).
- Continua redondo nas pontas. Traço livre (ainda não jogado) segue fino.

### 6. Traço cresce do 1º ponto ao 2º

Quando um traço **aparece**, ele anima: começa no ponto de origem e cresce até o destino.

**Aceite**

- Duração ~**280 ms** (`STROKE_GROW_MS`). Easing curto (ease-out).
- **Quem jogou neste aparelho:** origem = o ponto do primeiro toque; destino = o segundo.
- **Outros, bot, timeout, espectador:** cresce do extremo “inicial” da aresta (H: esquerda→direita; V: cima→baixo). O servidor não guarda o 1º clique.
- Quadrado só pinta **depois** da animação daquele traço.
- Traços que já estavam no snapshot (F5, resume) **não** reanimam.
- Um traço por vez na tela (bate com “um lance de bot por poll”). Extra: anima, depois libera o próximo toque.
- Sem animação essencial só no hover.

### 7. Entrar na sala pede nick e cor

Ninguém vê o tabuleiro nem senta sem nick e cor válidos.

**Aceite**

- **Lobby** sem `seatToken`: formulário **Entrar** (jogador), nick/cor, como hoje. Botão “Entrar”.
- **`playing`** sem `seatToken` e sem `watchToken`: o **mesmo tipo de formulário** (nick/cor da preferência do aparelho). Botão visível **Assistir**. Não cria assento; cria `watchToken`.
- Nick único na sala entre jogadores **e** espectadores (`nick_taken`). Cor do espectador única entre espectadores; pode repetir a de um jogador. Paleta igual. Sem nick/cor, o POST recusa.
- F5: `seatToken` resume jogador; `watchToken` resume espectador. Sem token: de novo o formulário.
- `game:draw` / POST draw com só `watchToken`: recusa. Espectador não vira bot.
- Status `lobby` cheio: formulário de jogador recusa `room_full`; não oferece Assistir no lobby.

### 8. Assistir

Com `watchToken` e sala `playing` (ou `finished` depois de ter assistido).

**Aceite**

- Vê HUD (caneta + vez + relógio + placar + `{n}/3`) e o tabuleiro. Sem toque de lance. Sem borda/vinheta da vez.
- Rótulo “Assistindo”.
- Poll GET com `x-watch-token` a cada `LOBBY_POLL_MS` (aba visível). Sem poll ~15 s: o servidor tira da lista de quem assiste.
- `finished`: pausa de 3 s se viu o último lance; F5 em sala já `finished` com token → resultado. Voltar à home.

### 9. Quem assiste, na tela de quem joga

Quem tem assento em `playing` vê quantas pessoas assistem.

**Aceite**

- Ícone de **olho** + número **só se houver pelo menos um espectador**. Sem ninguém assistindo, o olho não aparece.
- Clique no número (ou no olho) abre um **balão** na mesma tela: lista de nicks (caneta da cor de cada um).
- Fecha ao clicar fora, no olho de novo ou Escape. Não navega, não muda de rota, não empurra o tabuleiro de forma permanente.
- Atualiza com o snapshot (poll 1 s). Espectador **não** precisa do olho (só quem joga).
- `{n}/3` continua sendo só jogadores (assentos), não espectadores.

### 10. Partidas ao vivo (todas)

Na home, lista **todas** as salas em `playing` (qualquer pessoa), no estilo chess.com.

**Aceite**

- Cada item: nicks + cores, `{n}/3`, tamanho da grade (ex. `5×5`), placar de quadrados se já houver.
- Toque → `/sala/:codigo`; se ainda não tiver `watchToken`, cai no formulário **Assistir** (nick/cor). Se o aparelho tiver `seatToken` daquela sala, a linha destaca **Sua partida** e o toque volta ao assento.
- Atualiza sozinha (mesmo GET de presença/ao vivo, `PRESENCE_POLL_MS` / 3 s, aba visível).
- Sala `finished` ou `lobby` **não** entra na lista. Lista vazia: “Nenhuma partida agora.”
- Sem `seatToken` na listagem. Ordem: mais recentemente atualizadas primeiro.

### 11. Online na home

Quem está com o app aberto (home visível, nick válido) aparece numa lista **Online** na home.

**Aceite**

- Você não aparece na própria lista.
- Cada linha: caneta/cor + nick + **Desafiar** (se estiver livre) ou **Jogando** desabilitado (se já estiver em partida).
- Heartbeat a cada `PRESENCE_POLL_MS` (3 s) enquanto a home está visível. Some da lista ~15 s sem ping (`PRESENCE_TTL_MS`). Fechar a aba, trocar de app ou esconder a home manda `POST /api/presence/leave` na hora — some da lista no próximo GET e não recebe desafio. A partida assistida/jogada continua no poll de 1 s (`LOBBY_POLL_MS`).
- Sem nick válido: lista dos outros ainda aparece; você não entra nela até ter nick.
- Em partida (assento numa sala viva): permanece na lista Online com o botão **Jogando** (desabilitado, cinza). Quem só assiste (`watchToken`) não entra na lista. No “Ao vivo” só se estiver **jogando**.
- Sem contas: o mesmo nick em dois celulares são duas presenças.

### 12. Desafiar

O desafiante toca **Desafiar**. O desafiado vê uma **notificação fixa no topo** (não é o toast de erro).

**Aceite**

- Notificação: caneta/cor + “{nick} te desafiou” + grade + **Aceitar** / **Recusar**. Área de toque ≥ 44px.
- Aparece na **home** do desafiado (onde está o heartbeat). Não interrompe quem está jogando ou assistindo — alvo ocupado recusa `challenge_busy`.
- Aceitar: o servidor cria a sala, senta os dois (desafiante = host), os dois vão para `/sala/:codigo`. Grade = preferência do desafiante (`cols`/`rows` do ping). Nick/cor de cada um; se a cor do aceitante colidir, o servidor escolhe a próxima livre; se o nick colidir, sufixo ` 2`, ` 3`.
- Recusar ou expirar (**15 s**, `CHALLENGE_TTL_MS`): some o balão; o desafiante leva toast “{nick} recusou” / “Desafio expirou”.
- Um desafio pendente por pessoa (enviado ou recebido). Novo desafio com pendente: `challenge_pending`.
- Desafiar a si mesmo: `challenge_self`. Alvo offline (saiu, `leave`, ou `seenAt` velho): `challenge_gone`. O desafiante **não** vê “Desafio enviado.” — toast “Essa pessoa não está mais online.” e a pessoa some da lista.
- F5 na home: se o desafio ainda vale, a faixa reaparece.

## Fora de escopo

Contas, ranking, chat, replay, filas ranqueadas, espectador sentar no meio da partida, desafio a quem já está jogando, mais de 3 jogadores.
