import type { Todo } from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const authApi = {
  status: () => request<{ hasPassword: boolean; loggedIn: boolean }>('GET', '/auth/status'),
  setup: (password: string) => request<void>('POST', '/auth/setup', { password }),
  login: (password: string) => request<void>('POST', '/auth/login', { password }),
  logout: () => request<void>('POST', '/auth/logout'),
}

export const todosApi = {
  list: () => request<Todo[]>('GET', '/todos'),
  create: (title: string) => request<Todo>('POST', '/todos', { title }),
  update: (id: string, changes: Partial<Pick<Todo, 'title' | 'completed'>>) =>
    request<Todo>('PATCH', `/todos/${encodeURIComponent(id)}`, changes),
  remove: (id: string) => request<void>('DELETE', `/todos/${encodeURIComponent(id)}`),
  clearCompleted: () => request<Todo[]>('POST', '/todos/clear-completed'),
  toggleAll: () => request<Todo[]>('POST', '/todos/toggle-all'),
  import: (todos: Todo[]) => request<Todo[]>('POST', '/todos/import', { todos }),
}
