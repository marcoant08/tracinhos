# Contrato WebSocket — v3

Além do [002](../../002-sala-e-espectador/contracts/websocket.md):

```
{ "type": "room:addLocal", "nick": "Bia", "color": "blue" }
```

O socket já está autenticado pelo `room:resume` do remoto dono. Resposta: `game:state` ou `room:error`.

`game:draw` não muda o payload. O servidor aceita o lance se a vez for do dono do token **ou** de um local com `ownerPlayerId` igual a esse dono.
