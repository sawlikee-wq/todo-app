import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

export const DB_PATH =
  process.env.TODO_DB ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'todos.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;

  -- Single-user app: at most one row.
  CREATE TABLE IF NOT EXISTS credential (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    salt TEXT NOT NULL,
    hash TEXT NOT NULL
  );

  -- token_hash is sha256 of the cookie value, so a leaked DB can't be replayed.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`)
