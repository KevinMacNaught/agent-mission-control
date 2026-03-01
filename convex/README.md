# Convex Backend

This directory contains Convex functions and schema for local self-hosted development.

## Kanban MVP functions

- `schema.ts` defines `boards`, `columns`, `cards`, and `activities`.
- `kanban.ts` exposes board bootstrap/query and drag/drop move mutations.

## Local self-hosted workflow

1. Start Convex backend + dashboard via Docker Compose in `convex/self-hosted/docker-compose.yml`.
2. Generate an admin key from the backend container.
3. Set local env vars in `.env.local` (see `.env.example`).
4. Run `npm run convex:dev` (non-interactive once backend + keys are configured).
