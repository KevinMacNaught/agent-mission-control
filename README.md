# Agent Mission Control

Mission-control web app for orchestrated coding workflows.

- Next.js + React + TypeScript
- shadcn/ui components only
- dnd-kit for Kanban interactions
- Convex self-hosted for app state (no ORM layer)

## Development setup (Convex self-hosted)

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
- `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`

### 5) Push/check functions

```bash
npm run convex:check
```

This runs a non-interactive `convex dev --once` check against the self-hosted backend.

If the backend is not initialized yet, use:

```bash
npm run convex:check:bootstrap
```

### 6) Start frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful scripts

- `npm run lint`
- `npm run build`
- `npm run convex:dev` - watch/push Convex functions continuously
- `npm run convex:check` - run Convex checks against self-hosted backend
- `npm run convex:check:bootstrap` - bootstrap checks with typecheck disabled
- `npm run convex:self-hosted:up` - start local Convex backend + dashboard
- `npm run convex:self-hosted:down` - stop local Convex services
