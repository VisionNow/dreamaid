# Copilot Instructions

## Project Overview

**ba-ide-mvp** — a browser-based Business Analyst IDE for creating and editing Mermaid flow diagrams. The frontend is a Next.js static export served by a Rust/Axum backend.

- **Remote**: `git@github.com:RevDra/UBA_Unified-Business-Analytics.git`
- **Active development branch**: `feat/backend`
- **Production branch**: `main` (deployed to GitHub Pages — frontend only)

---

## Commands

### Frontend (repo root)

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Static export → /out
npm run lint     # ESLint
```

### Backend (`backend/`)

```bash
cp .env.example .env   # first time — set JWT_SECRET
cargo check            # compile check (fast)
cargo test             # run integration tests (in-memory SQLite)
cargo run              # start server at :8080
cargo build --release  # production binary
```

Run a single integration test:
```bash
cargo test test_name -- --nocapture
```

---

## Architecture

### Monorepo layout

```
repo root/
├── src/app/page.tsx     ← entire frontend UI (single file)
├── backend/             ← Rust/Axum API server
│   ├── src/
│   │   ├── main.rs      ← server entry, routes wired here
│   │   ├── lib.rs       ← build_router() exported for tests
│   │   ├── auth/        ← register, login, JWT middleware
│   │   ├── diagrams/    ← CRUD handlers + model
│   │   ├── sharing/     ← share-link creation and access
│   │   └── export/      ← diagram export endpoint
│   ├── migrations/      ← sqlx migration files (append-only)
│   └── tests/
│       └── api_test.rs  ← integration tests using in-memory SQLite
```

### Request flow

1. All HTTP traffic hits the Axum server on `:8080`
2. Routes under `/api/*` go to Rust handlers
3. Everything else falls through to `ServeDir` serving the Next.js `/out` static export — **no CORS needed** (same origin)

### Frontend: Bidirectional Code ↔ Diagram sync

The core mechanic in `page.tsx`:

- **Code → Diagram**: `parseMermaid(code)` → `{ nodes, edges }`. Triggered by "Sync Code to Visual" button. Parse errors → Monaco error markers + Problems terminal.
- **Diagram → Code**: `generateMermaidFromFlow(nodes, edges)` is called by `updateCodeFromFlow()` on every canvas interaction (drag, connect, drop, resize).

### Extended Mermaid syntax

Node geometry is persisted via `%%` comments — standard Mermaid tools ignore them:

```
nodeId["Label"] %% shape:actor x:100 y:200 w:120 h:40
```

### Edge consolidation

`consolidateEdges(edges)` runs on every edge mutation: two nodes with bidirectional edges → single `markerStart`+`markerEnd` arrow (same label) or two parallel curved edges (`data.isCurved: true`) if labels differ.

---

## Key Conventions

### Backend

- **Error handling**: All handlers return `AppResult<T>` (alias for `Result<T, AppError>`). `AppError::Internal` logs the real error server-side but sends a generic message to the client — never expose internal details.
- **Migrations**: Only add new `migrations/00N_name.sql` files. Never edit existing migration files.
- **IDs**: Use `new_id()` (24-char alphanumeric, from `lib.rs`) for all new entity IDs.
- **Integration tests**: `tests/api_test.rs` uses in-memory SQLite via `build_router()`. Each test calls `test_app()` to get a fresh router — no shared state between tests.
- **Config**: All config comes from env vars via `Config::from_env()`. Required vars: `JWT_SECRET`, `DATABASE_URL`. See `.env.example`.

### Frontend

- **Single-file component**: All UI logic lives in `src/app/page.tsx`. New subcomponents go in `src/app/components/`, hooks in `src/app/hooks/`.
- **Theme**: Use `theme.X` semantic keys (e.g., `theme.bgMain`, `theme.border`) — never hardcode Tailwind dark/light class variants.
- **Static export only**: `next.config.ts` sets `output: 'export'`. No Server Components, API routes, or server-side features.
- **React Flow panning**: `panActivationKeyCode={null}` — panning is always active without a modifier key.

### CI / Deployment

- `main` branch → automatically deployed to GitHub Pages (frontend static only) via `.github/workflows/nextjs.yml`
- `feat/backend` branch → CI workflow at `.github/workflows/ci.yml` (runs lint, build, cargo test)
- Backend requires a server runtime — not deployable to GitHub Pages
