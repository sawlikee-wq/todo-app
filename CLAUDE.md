# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-user, password-protected todo list that runs on localhost. Frontend: React 19 + TypeScript + Vite (`src/`). Backend: Express 5 on Node 24 (`server/`), storing everything in SQLite via Node's built-in `node:sqlite` — no native modules, so nothing needs compiling (the machine has no Xcode command-line tools).

## Commands

Run from `todo-app/`:

- `npm run dev` — runs the API (`dev:server`, port 3001, restarts on change via `node --watch`) and Vite (`dev:web`, port 5173) together with `concurrently`. Open http://localhost:5173; Vite proxies `/api` to the API (`vite.config.ts`).
- `npm run build` — type-checks frontend *and* server (`tsc -b`; `tsconfig.node.json` includes `server/`), then builds the frontend to `dist/`. This is the only type-check step.
- `npm start` — build, then run the API alone; it also serves `dist/` with an SPA fallback, so the whole app is on http://localhost:3001.
- `npm run lint` — Oxlint (`.oxlintrc.json`)

No test runner is set up. To exercise the API by hand without touching real data, run the server against a throwaway DB on another port: `TODO_DB=/tmp/test.db API_PORT=3999 node server/index.ts`.

Server env vars: `API_PORT` (default 3001; deliberately not `PORT`, which dev tooling sets for Vite and would collide) and `TODO_DB` (default `data/todos.db`). The server binds to 127.0.0.1 only.

The parent folder's `../.claude/launch.json` has a `todo-app` preview config that runs `npm run dev` for the Claude desktop browser pane.

## Architecture

- Server code is TypeScript run directly by Node's type stripping, so relative imports must include the `.ts` extension and only erasable syntax is allowed (no enums, parameter properties, or namespaces).
- `server/db.ts` opens the database (creating `data/`, gitignored) and creates the schema with `CREATE TABLE IF NOT EXISTS` — there is no migration system, so schema changes to existing tables need an explicit `ALTER TABLE` step. Tables: `credential` (single row, `id = 1`), `sessions`, `todos` (`completed` is 0/1; mapped to boolean in `server/todos.ts`).
- `server/auth.ts`: password stored as a salted scrypt hash; login creates a random session token sent as an httpOnly, SameSite=Strict cookie (`todo_session`, no max-age, so it ends when the browser closes) and stored server-side only as its sha256, with a 7-day expiry. `requireAuth` guards every `/api/todos` route. Password reset = delete the `credential` row (todos are kept).
- `server/index.ts` defines all routes and request validation. Bulk actions (`/todos/clear-completed`, `/todos/toggle-all`, `/todos/import`) return the full updated list so the client can replace its state.
- `src/api.ts` is the only place that calls `fetch`; non-2xx responses throw `ApiError` with the server's `error` message.
- `src/AuthGate.tsx` asks `/api/auth/status` which screen to show (create password / log in / app / "can't reach server"), and passes a stable `lock` callback into `App`. `src/useTodos.ts` uses that same callback when any request returns 401, so keep it memoized — the initial-load effect depends on it.
- `src/useTodos.ts` updates local state from server responses (not optimistically). On first load it does a one-time import of todos left in `localStorage` key `todos.v1` by the earlier browser-only version, then deletes that key.
- `src/App.tsx` is presentation only and derives the visible list and counts on each render.
- Styling is plain CSS in `src/index.css`, using CSS custom properties on `:root` with a `prefers-color-scheme: dark` override. Use those variables for new colors so dark mode keeps working.

## TypeScript settings to be aware of

Both tsconfigs enable `verbatimModuleSyntax` (type-only imports must use `import type`), `erasableSyntaxOnly`, and `noUnusedLocals`/`noUnusedParameters`, which fail the build.
