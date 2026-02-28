# Agent Mission Control

Next.js frontend + Convex backend for mission tracking.

## Development setup (Convex self-hosted)

This repo is configured to use **self-hosted Convex locally** (not Prisma/SQLite in app code).

### 1) Install dependencies

```bash
npm install
```

### 2) Start Convex backend + dashboard (Docker)

```bash
npm run convex:self-hosted:up
```

- Backend API: `http://127.0.0.1:3210`
- HTTP actions/site proxy: `http://127.0.0.1:3211`
- Dashboard: `http://127.0.0.1:6791`

### 3) Generate admin key

```bash
docker compose -f convex/self-hosted/docker-compose.yml exec backend ./generate_admin_key.sh
```

### 4) Configure local env (do not commit secrets)

```bash
cp .env.example .env.local
# then set CONVEX_SELF_HOSTED_ADMIN_KEY in .env.local
```

Required vars in `.env.local`:

- `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210`
- `CONVEX_SELF_HOSTED_ADMIN_KEY=<generated key>`
- `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`

### 5) Push functions to local backend

```bash
npm run convex:check
```

This runs a non-interactive `convex dev --once` against the self-hosted backend.

### 6) Start frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful commands

- `npm run convex:dev` - watch/push Convex functions continuously
- `npm run convex:self-hosted:up` - start local Convex backend + dashboard
- `npm run convex:self-hosted:down` - stop local Convex services
