# Issue Alignment Notes

## Backend stack assumptions

If an issue mentions SQLite/Prisma for local data storage, treat that as outdated unless explicitly re-scoped.

Current expected implementation target:

- **Convex self-hosted local backend** (Docker Compose)
- Convex functions in `convex/`
- Env wiring through `.env.local` using `CONVEX_SELF_HOSTED_*` vars

## Review checklist for backend-related issues

- [x] Uses Convex functions/API instead of app-managed SQLite/Prisma paths
- [x] Documents required env vars without committing secrets
- [x] Includes local verification command(s) that do not require cloud login

## Issue #3 (Milestone 2 Kanban MVP)

- Convex schema + queries/mutations persist board columns/cards and move history.
- dnd-kit powers sortable columns/cards with cross-column card movement.
- UI surfaces activity history from Convex (`card_moved` and `column_moved`).
