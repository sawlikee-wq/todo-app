import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import {
  endSession,
  hasPassword,
  isLoggedIn,
  requireAuth,
  setPassword,
  startSession,
  verifyPassword,
} from './auth.ts'
import { DB_PATH } from './db.ts'
import {
  clearCompleted,
  createTodo,
  deleteTodo,
  importTodos,
  listTodos,
  toggleAll,
  updateTodo,
  type Todo,
} from './todos.ts'

// Not `PORT`: dev tooling often sets that for the Vite server, which would collide.
const PORT = Number(process.env.API_PORT ?? 3001)
const MIN_PASSWORD = 4
const MAX_TITLE = 500

const app = express()
app.use(express.json({ limit: '1mb' }))

const badRequest = (res: Response, error: string) => res.status(400).json({ error })

function readTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const title = value.trim()
  return title && title.length <= MAX_TITLE ? title : undefined
}

// --- auth ---

app.get('/api/auth/status', (req, res) => {
  res.json({ hasPassword: hasPassword(), loggedIn: isLoggedIn(req) })
})

app.post('/api/auth/setup', (req, res) => {
  if (hasPassword()) return res.status(409).json({ error: 'A password is already set.' })
  const { password } = req.body ?? {}
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return badRequest(res, `Use at least ${MIN_PASSWORD} characters.`)
  }
  setPassword(password)
  startSession(res)
  res.status(204).end()
})

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body ?? {}
  if (typeof password !== 'string' || !verifyPassword(password)) {
    return res.status(401).json({ error: 'Wrong password.' })
  }
  startSession(res)
  res.status(204).end()
})

app.post('/api/auth/logout', (req, res) => {
  endSession(req, res)
  res.status(204).end()
})

// --- todos ---

const todos = express.Router()
todos.use(requireAuth)

todos.get('/', (_req, res) => {
  res.json(listTodos())
})

todos.post('/', (req, res) => {
  const title = readTitle(req.body?.title)
  if (!title) return badRequest(res, 'Title is required.')
  res.status(201).json(createTodo(title))
})

todos.post('/import', (req, res) => {
  const items: unknown = req.body?.todos
  if (!Array.isArray(items)) return badRequest(res, 'Expected { todos: [...] }.')
  const valid: Todo[] = []
  for (const t of items) {
    const title = readTitle(t?.title)
    if (typeof t?.id === 'string' && title && typeof t.createdAt === 'number') {
      valid.push({ id: t.id, title, completed: t.completed === true, createdAt: t.createdAt })
    }
  }
  importTodos(valid)
  res.json(listTodos())
})

todos.post('/clear-completed', (_req, res) => {
  clearCompleted()
  res.json(listTodos())
})

todos.post('/toggle-all', (_req, res) => {
  toggleAll()
  res.json(listTodos())
})

todos.patch('/:id', (req: Request<{ id: string }>, res) => {
  const changes: { title?: string; completed?: boolean } = {}
  if (req.body?.title !== undefined) {
    const title = readTitle(req.body.title)
    if (!title) return badRequest(res, 'Title can’t be empty.')
    changes.title = title
  }
  if (req.body?.completed !== undefined) {
    if (typeof req.body.completed !== 'boolean') return badRequest(res, 'completed must be a boolean.')
    changes.completed = req.body.completed
  }
  const todo = updateTodo(req.params.id, changes)
  if (!todo) return res.status(404).json({ error: 'Not found.' })
  res.json(todo)
})

todos.delete('/:id', (req: Request<{ id: string }>, res) => {
  if (!deleteTodo(req.params.id)) return res.status(404).json({ error: 'Not found.' })
  res.status(204).end()
})

app.use('/api/todos', todos)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))

// In production (`npm start`) the server also serves the built frontend.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*path}', (_req, res) => res.sendFile(join(dist, 'index.html')))
}

// Bound to 127.0.0.1 so it's only reachable from this machine.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API listening on http://localhost:${PORT} (database: ${DB_PATH})`)
})
