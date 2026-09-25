export function RulesContent() {
  return (
    <div className="rules">
      <h2>Objetivo</h2>
      <p>
        Ligue os pontos da grade. Quem fecha um quadrado ganha 1 ponto e pinta o
        quadrado com a sua cor. No fim, vence quem tem mais quadrados. Empate
        vale para todos com a maior pontuação.
      </p>

      <h2>Como traçar</h2>
      <ol>
        <li>Na sua vez, toque um ponto. Ele pisca.</li>
        <li>
          Os vizinhos livres (cima, baixo, esquerda, direita — nunca na diagonal)
          piscam noutra cor.
        </li>
        <li>Toque o segundo ponto. Só então o traço entra.</li>
      </ol>
      <p>Toque de novo a origem para cancelar. Traço já feito não serve de destino.</p>

      <h2>Turnos</h2>
      <p>
        Sem fechar quadrado, a vez passa ao próximo. Quem fecha um (ou dois) quadrados
        pontua e <strong>é obrigado a traçar de novo</strong> — joga outra vez até um
        traço que não feche.
      </p>

      <h2>Tempo</h2>
      <p>
        Cada humano tem 40 segundos para completar os dois toques. Se o tempo
        acabar sem traço, o jogo marca <strong>um traço aleatório no nome dessa
        pessoa</strong> (pode até fechar quadrado). Se não fechar, a vez passa; se
        fechar, essa pessoa joga de novo. Um aviso aparece no canto da tela.
      </p>
      <p>
        Bots jogam sozinhos, um traço por vez, depois de pensar 1 segundo. Se
        fecharem quadrado, pensam de novo e traçam outra vez. Sempre fecham
        quando podem; se não puderem, evitam deixar um quadrado quase pronto
        para o próximo — e, se não tiver jeito, escolhem o traço que abre
        menos quadrados.
      </p>

      <h2>Sala</h2>
      <p>
        Até 3 participantes (humanos e bots). O host começa a partida. Recarregar
        a página (F5) devolve você como o mesmo jogador. Dá para assistir uma
        partida que já começou.
      </p>
    </div>
  );
}
