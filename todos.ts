import { randomUUID } from 'node:crypto'
import { db } from './db.ts'

export type Todo = { id: string; title: string; completed: boolean; createdAt: number }

type Row = { id: string; title: string; completed: number; created_at: number }

const toTodo = (r: Row): Todo => ({
  id: r.id,
  title: r.title,
  completed: r.completed === 1,
  createdAt: r.created_at,
})

export const listTodos = () =>
  (db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all() as Row[]).map(toTodo)

export const getTodo = (id: string) => {
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Row | undefined
  return row && toTodo(row)
}

export function createTodo(title: string): Todo {
  const todo = { id: randomUUID(), title, completed: false, createdAt: Date.now() }
  db.prepare('INSERT INTO todos (id, title, completed, created_at) VALUES (?, ?, 0, ?)').run(
    todo.id,
    todo.title,
    todo.createdAt,
  )
  return todo
}

export function updateTodo(id: string, changes: { title?: string; completed?: boolean }) {
  const current = getTodo(id)
  if (!current) return undefined
  const next = { ...current, ...changes }
  db.prepare('UPDATE todos SET title = ?, completed = ? WHERE id = ?').run(
    next.title,
    next.completed ? 1 : 0,
    id,
  )
  return next
}

export const deleteTodo = (id: string) =>
  Number(db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes) > 0

export const clearCompleted = () => db.prepare('DELETE FROM todos WHERE completed = 1').run()

export function toggleAll() {
  const anyActive = db.prepare('SELECT 1 FROM todos WHERE completed = 0 LIMIT 1').get()
  db.prepare('UPDATE todos SET completed = ?').run(anyActive ? 1 : 0)
}

// Used once to move todos saved in the browser by the old localStorage version.
export function importTodos(todos: Todo[]) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO todos (id, title, completed, created_at) VALUES (?, ?, ?, ?)',
  )
  db.exec('BEGIN')
  try {
    for (const t of todos) insert.run(t.id, t.title, t.completed ? 1 : 0, t.createdAt)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
