# MCPSurface

Phase 1 MVP scaffold for a creator-defined platform builder with:

- pnpm monorepo
- React + TanStack Router web app
- Fastify backend
- shared domain models and contracts
- Clerk auth shell
- file-based platform persistence

## Workspace

- `apps/web`: creator-facing frontend
- `apps/server`: API and persistence
- `packages/shared`: domain models, schemas, and contracts

## Phase 1 Commands

```bash
pnpm install
pnpm dev:server
pnpm dev:web
pnpm typecheck
```

## Environment

Copy `.env.example` to `.env` in the repo root and set your Clerk publishable key before running the web app.
