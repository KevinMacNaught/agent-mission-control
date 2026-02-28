# Project Spec (Data/Backend)

## Backend decision

Agent Mission Control uses **Convex self-hosted** for local development.

## Explicit non-goals

- Do **not** introduce Prisma as the primary data path for local development.
- Do **not** add direct app-managed SQLite migrations/models as the source of truth.

## Local architecture

- Convex backend container (`ghcr.io/get-convex/convex-backend`)
- Convex dashboard container (`ghcr.io/get-convex/convex-dashboard`)
- Next.js frontend calling Convex via `NEXT_PUBLIC_CONVEX_URL`

## Required environment variables

- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `NEXT_PUBLIC_CONVEX_URL`

## Verification requirement

All local backend verification should be possible non-interactively with:

```bash
npm run convex:check
```

No Convex cloud login should be required when `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` are set.
