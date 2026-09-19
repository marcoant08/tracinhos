# Spec-Driven Development neste repositório

Este projeto existe para praticar SDD: a spec é a fonte da verdade. O código implementa a spec. Os testes verificam a spec.

## Ordem de trabalho

1. Ler [constitution.md](constitution.md) — princípios que não mudam sem acordo explícito.
2. Escrever ou atualizar a feature em `specs/NNN-nome/`.
3. Só então implementar o código referenciado em `tasks.md`.
4. Se código e spec divergirem, **a spec vence** até alguém atualizar a spec de propósito.

## Anatomia de uma feature

```
specs/001-jogo-tracinhos/
  spec.md        # o que o usuário faz e o que significa "pronto"
  domain.md      # regras do jogo como máquina de estados
  plan.md        # arquitetura e ADRs
  ui.md          # telas e estados visuais
  tasks.md       # fatias implementáveis ligadas à spec
  contracts/     # REST e WebSocket
```

## Regra de ouro

Não “consertar” a spec em silêncio para caber no código. Se a regra mudou, mude a spec primeiro, depois o patch.
