# Tracinhos

Jogo dos tracinhos (ligar os pontos) — projeto para praticar Spec-Driven Development.

As regras do produto e da arquitetura estão em [`specs/`](specs/). O código implementa essas specs.

## Desenvolvimento

Copie [`.env.example`](.env.example) para `apps/web/.env.local` e preencha as variáveis do Redis Upstash.

```bash
npm install
npm test
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, o app usa memória do processo (só serve para um único servidor).

## Vercel

1. Importe o repositório (Root Directory = raiz do monorepo).
2. Framework: Next.js. O `vercel.json` já aponta `npm run build`.
3. Ative Fluid compute (padrão em projetos novos).
4. Defina `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (Marketplace Upstash ou o mesmo par do `.env.local`).
5. WebSocket fecha no `maxDuration` do plano; o cliente reconecta sozinho (F5 e corte de socket usam o mesmo `seatToken`).

## Specs

Comece por [`specs/README.md`](specs/README.md) e [`specs/constitution.md`](specs/constitution.md).
