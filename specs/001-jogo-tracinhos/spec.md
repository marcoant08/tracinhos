# Spec — Jogo dos Tracinhos (v1)

Produto: partida multiplayer de ligar pontos (dots and boxes) em sala com código, até 5 participantes (humanos e/ou bots), jogável no celular.

Referências: [domain.md](domain.md), [ui.md](ui.md), [contracts/](contracts/).

## Atores

- **Visitante**: ainda não entrou na sala.
- **Jogador**: humano com assento (nick, cor, `playerId`, `seatToken`).
- **Host**: primeiro jogador da sala; pode adicionar bots e iniciar.
- **Bot**: assento controlado pelo servidor.

## Histórias e aceite

### 1. Criar sala

O visitante escolhe tamanho da grade (quadradas 2×2 a 10×10, ou 10×15 pontos = 9×14 quadrados; padrão 5×5), nick e cor, e cria a sala.

**Aceite**

- Recebe um código curto (4 caracteres A–Z e 2–9, sem I/O/0/1).
- É redirecionado para `/sala/:codigo` já como host.
- Sessão `{ playerId, seatToken, nick, color, roomCode }` é persistida no `localStorage`.
- Nick, cor e tamanho da grade vêm da preferência do aparelho (`tracinhos:identity`); F5 no lobby não zera. Nick/cor gravados depois de criar/entrar com sucesso; a grade gravada ao selecionar (e de novo ao criar).
- O select de tamanho da grade é grande o bastante para o polegar (maior que um input comum).
- Sem nick válido ou cor da paleta, a sala não é criada.

### 2. Entrar na sala

O visitante informa o código, escolhe nick e cor ainda livres.

**Aceite**

- A tela mostra nicks já na sala e desabilita cores ocupadas (atualização ao vivo).
- Nick e cor vêm da preferência do aparelho; se a cor estiver ocupada, permanece visível mas não dá para confirmar até trocar.
- Servidor recusa `nick_taken` ou `color_taken` (nick comparado sem maiúsculas).
- Sala cheia (5 assentos) recusa `room_full`.
- Partida já iniciada recusa novo join (`game_already_started`), exceto resume.
- Código inexistente: `room_not_found`.

### 3. Identidade única

Nick: 2–16 caracteres após trim. `Ana` e `ana` colidem. Exibição usa o texto digitado.

Cor: uma das 8 cores da paleta. Sem hex livre.

Bots: nome sorteado de `BOT_NICKS` (array fixo, fácil de editar), exibido como `Bot {nome}` (ex.: `Bot Jompes`), sem colidir com nicks já na sala. Se a lista acabar, cai em `Bot 1`, `Bot 2`, …. Primeira cor livre. Host não escolhe nick nem cor do bot.

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
- “Adicionar bot” **desabilitado** com 5 assentos (`MAX_PLAYERS`); o servidor ainda recusa `room_full`.
- Com 1 participante, iniciar falha (`not_enough_players`).
- Ao iniciar, status vira `playing` e todos recebem o snapshot do tabuleiro vazio.
- Lista de quem já está na sala (host e join) atualiza **sozinha** quando entra gente ou bot — sem F5.
- Só o host altera **quem começa** (select; padrão **Aleatório**; `not_host` se outro tentar). Os demais vêem o valor atual ao vivo, sem controle. A rotação segue a ordem de assento; só o primeiro índice muda.
- Ordem dos turnos = ordem de assento (join / bots na sequência em que entraram), a partir de quem o host escolheu (ou do sorteio).
- “Copiar link” copia `{origin}/sala/{codigo}`, não só o código de 4 letras.
- No join pelo link, o botão visível é **Entrar** (não “Sentar”).

### 6. Jogar

Um jogador de cada vez. Na sua vez, o humano forma o traço em **dois toques**:

1. Toca um ponto (origem). Esse ponto **pisca**.
2. Os vizinhos imediatos **livres** (acima, abaixo, esquerda, direita — nunca diagonal) **piscam noutra cor**.
3. Toca o segundo ponto. Só então o traço é enviado.

**Aceite**

- Segundo ponto que não é vizinho imediato: não desenha; se o ponto clicado tiver vizinhos livres, passa a ser a nova origem.
- Tocar de novo a origem cancela a seleção.
- Traço já existente: esse par **não** aparece como destino e `game:draw` recusa `illegal_move`.
- Jogada fora da vez: `not_your_turn`; a seleção some quando não é a sua vez. A tela de “sua vez” e o clique seguem o snapshot do servidor (não um lance local ainda não confirmado).
- Fechar 1 quadrado: marca com a cor do jogador, +1 ponto; **quem fechou é obrigado a traçar de novo** (mesma vez).
- Fechar 2 quadrados no mesmo traço: marca os dois, +2; **também joga de novo**.
- Sem fechar quadrado: a vez **passa** ao próximo. Alternância só nesse caso.
- Bot na vez: o servidor joga **sozinho**, **uma jogada por vez**, depois de **1 s visível** (`BOT_THINK_MS`) com o nome dele no HUD. Fecha se puder; senão evita deixar quadrado com 3 lados; se for obrigado, escolhe o lance que deixa menos. Se fechar, pensa de novo (mais 1 s) e joga outra vez. Nunca aplica 2 lances de bot no mesmo instante. Na Vercel o timer do isolate some: o GET do poll aplica o lance vencido, um por busca.
- Humano na vez tem **40 s** (`TURN_TIMEOUT_MS`) para completar o traço (os dois toques). Acabou o tempo sem traço: o servidor marca **um traço aleatório legal no nome dessa pessoa**; se esse traço não fechar quadrado a vez passa; se fechar, a pessoa joga de novo (novo prazo). Todos veem um toast avisando.
- O prazo é do servidor (`turnDeadlineAt` na sala). Vale para **humano e bot** (bot: agora + `BOT_THINK_MS`). F5 e reconectar mostram o tempo restante, não o prazo cheio de novo.
- Relógio (número + anel) **sempre visível** na vez, inclusive bot.
- No placar, o nick da vez fica **em negrito** com `👈` depois do nome.
- No HUD (e no resultado), cada linha mostra **quadrados e traços** daquela pessoa. Traços = arestas com o `playerId` dela (inclui timeout). A vitória continua sendo por quadrados.
- Papel da grade, **só na tela de quem está na vez:** borda pisca na cor do jogador; laranja + fade aos ≤ 10 s; vermelho + fade aos ≤ 5 s. Vez de outra pessoa ou bot: tabuleiro normal. Sem WS: faixa fixa no rodapé “Sem conexão com o servidor”.

### 7. Fim

Quando não restam arestas livres, a partida termina.

**Aceite**

- Vence quem tem mais quadrados.
- Empate: todos com a pontuação máxima empatada são vencedores.
- Snapshot `finished` + lista de `winnerIds` (o servidor marca o fim na hora).
- A UI **segura o tabuleiro 3 s** (`RESULT_HOLD_MS`) depois do último traço, para dar tempo de ver o quadrado pintar. Só então troca para a **tela de resultado**: placar completo (nick + cor + quadrados + traços) e o(s) nome(s) do vencedor em destaque. Empate: destaca todos os empatados.
- F5 já em `finished`: vai direto ao resultado (sem a pausa).

### 8. Desconexão

Humano some: a partida não trava.

**Aceite**

- Após 30s **sem presença** (WS da conexão atual e sem GET/lance com o token), o assento vira bot (mantém nick/cor/`playerId`).
- Fechar o WS num isolate velho **não** marca desconexão se a pessoa já deu resume noutro isolate (`wsEpoch`).
- GET com `x-seat-token` conta como presença e devolve humano se o assento tinha virado bot por desconexão.
- Se for a vez dele e já for bot, o bot joga.
- Resume no prazo devolve `kind: human` ao dono do token.

### 9. Mobile

Fluxo completo cabe e é usável em ~360×640.

**Aceite**

- Botões e seletor de cor com área de toque ≥ 44px.
- HUD (vez, placar, tempo, “sua vez”) permanece visível e **com altura fixa** (não empurra o tabuleiro quando o texto muda).
- Todos os pontos da grade cabem na tela de uma vez; o tabuleiro escala para o espaço abaixo do HUD.
- Sem ação essencial só no hover.
- Erros e o aviso de timeout (traço aleatório) em toast no canto superior direito.
- Botão reage ao toque (animação CSS de pressionar).
- Existe `/regras` com o resumo jogável (turnos, dois toques, tempo, timeout, bot 1 s). Link só na home e na sala (join/lobby); não na partida nem no resultado.

## Fora de escopo

Contas, ranking, chat, replay, dificuldade de bot, espectadores, sair da sala no meio para liberar o assento a outra pessoa (v1 o assento permanece até a sala expirar).
