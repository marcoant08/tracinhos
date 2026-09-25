# Contrato WebSocket — v2

O WS da **sala** não muda para espectador (espectador não abre assento). Desafio e online **não** exigem WS novo: vão no GET `/api/lobby`.

Opcional depois: o mesmo `/ws` pode aceitar `{ "type": "presence:hello", "presenceToken": "..." }` para inbox push. Fora desta fatia — o poll de 3 s (`PRESENCE_POLL_MS`) cumpre o aceite.

Erros novos só no REST de desafio: `challenge_busy`, `challenge_pending`, `challenge_gone`, `challenge_self`.
