# Web (seller portal + admin panel)

Next.js (App Router) + Tailwind. It talks to the backend through `/api/*`, which Next.js forwards to
`API_URL` (default `http://localhost:3000`), so no CORS setup is needed.

## Run locally

Start the backend first (`npm run start:dev` in the repo root), then:

```bash
cd web
cp .env.example .env     # only needed if the backend is not on localhost:3000
npm install
npm run dev              # http://localhost:3001
```

## Screens

Seller: dashboard, package and payment, products (list, create, options, variations, submit, propose changes), CSV import and export.
Admin: dashboard, sellers (approve/suspend), subscriptions and payments, review queue, categories, packages, bank details.

## Branding

The brand colour is a single setting in `app/globals.css` (`--brand`). Logo text is in `components/Shell.tsx` and `components/AuthForm.tsx`.
