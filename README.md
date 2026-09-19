# Tracinhos

Jogo dos tracinhos (ligar os pontos) — projeto para praticar Spec-Driven Development.

As regras do produto e da arquitetura estão em [`specs/`](specs/). O código implementa essas specs.

## Subir tudo (local)

```bash
docker compose up --build
```

Abra [http://localhost:3000](http://localhost:3000).

## Desenvolvimento sem Docker

Suba um Redis e:

```bash
export REDIS_URL=redis://127.0.0.1:6379
npm install
npm test
npm run dev
```

Sem `REDIS_URL`, o app usa memória do processo (só serve para um único servidor).

## Vercel

1. Importe o repositório (Root Directory = raiz do monorepo).
2. Framework: Next.js. O `vercel.json` já aponta `npm run build`.
3. Ative Fluid compute (padrão em projetos novos).
4. Crie um Redis no Marketplace (Upstash) e defina `REDIS_URL` (`rediss://...`).
5. WebSocket fecha no `maxDuration` do plano; o cliente reconecta sozinho (F5 e corte de socket usam o mesmo `seatToken`).

## Specs

Comece por [`specs/README.md`](specs/README.md) e [`specs/constitution.md`](specs/constitution.md).
