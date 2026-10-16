import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { db } from './db.ts'

export const COOKIE = 'todo_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

type CredentialRow = { salt: string; hash: string }

const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString('hex')

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const hasPassword = () => db.prepare('SELECT 1 FROM credential WHERE id = 1').get() !== undefined

export function setPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  db.prepare('INSERT INTO credential (id, salt, hash) VALUES (1, ?, ?)').run(
    salt,
    hashPassword(password, salt),
  )
}

export function verifyPassword(password: string): boolean {
  const row = db.prepare('SELECT salt, hash FROM credential WHERE id = 1').get() as
    | CredentialRow
    | undefined
  if (!row) return false
  const actual = Buffer.from(hashPassword(password, row.salt), 'hex')
  const expected = Buffer.from(row.hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function readToken(req: Request): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function isLoggedIn(req: Request): boolean {
  const token = readToken(req)
  if (!token) return false
  const row = db
    .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token)) as { expires_at: number } | undefined
  return row !== undefined && row.expires_at > Date.now()
}

export function startSession(res: Response) {
  const token = randomBytes(32).toString('base64url')
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(
    hashToken(token),
    Date.now() + SESSION_MS,
  )
  // No maxAge: the browser drops the cookie when it closes.
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/' })
}

export function endSession(req: Request, res: Response) {
  const token = readToken(req)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  res.clearCookie(COOKIE, { path: '/' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isLoggedIn(req)) return next()
  res.status(401).json({ error: 'Not logged in' })
}
