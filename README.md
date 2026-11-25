# System-Backend

An online marketplace backend system for 24Dokan.

NestJS + TypeScript, PostgreSQL (Prisma), REST with OpenAPI docs at `/docs`.
Design: see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

```bash
cp .env.example .env
docker compose up -d        # Postgres, Redis, MinIO
npm install
npx prisma migrate dev
npm run start:dev           # http://localhost:3000/api/health
```

## Scripts
`npm run build` · `npm test` · `npm run lint` · `npm run prisma:validate`

## Roadmap (Phase 1)
1A products, approval, packages · 1D inventory · 1B order entry · 1C fulfilment and returns
