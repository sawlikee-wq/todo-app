import { useCallback, useEffect, useState } from 'react'
import { ApiError, todosApi } from './api'
import type { Todo } from './types'

// Todos saved by the earlier localStorage-only version of the app.
const LEGACY_KEY = 'todos.v1'

function readLegacy(): Todo[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as Todo[]) : []
  } catch {
    return []
  }
}

export function useTodos(onUnauthorized: () => void) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized()
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    },
    [onUnauthorized],
  )

  const run = async (action: () => Promise<void>) => {
    setError('')
    try {
      await action()
    } catch (err) {
      fail(err)
    }
  }

  useEffect(() => {
    const load = async () => {
      const legacy = readLegacy()
      if (legacy.length === 0) return todosApi.list()
      const merged = await todosApi.import(legacy)
      localStorage.removeItem(LEGACY_KEY)
      return merged
    }
    load()
      .then(setTodos, fail)
      .finally(() => setLoading(false))
  }, [fail])

  const replace = (todo: Todo) => setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))

  return {
    todos,
    loading,
    error,
    add: (title: string) =>
      run(async () => {
        const todo = await todosApi.create(title)
        setTodos((prev) => [todo, ...prev])
      }),
    toggle: (id: string) =>
      run(async () => {
        const current = todos.find((t) => t.id === id)
        if (current) replace(await todosApi.update(id, { completed: !current.completed }))
      }),
    rename: (id: string, title: string) =>
      run(async () => replace(await todosApi.update(id, { title }))),
    remove: (id: string) =>
      run(async () => {
        await todosApi.remove(id)
        setTodos((prev) => prev.filter((t) => t.id !== id))
      }),
    clearCompleted: () => run(async () => setTodos(await todosApi.clearCompleted())),
    toggleAll: () => run(async () => setTodos(await todosApi.toggleAll())),
  }
}
