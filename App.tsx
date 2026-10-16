import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Filter, Todo } from './types'
import { useTodos } from './useTodos'

const FILTERS: Filter[] = ['all', 'active', 'completed']

function TodoItem({
  todo,
  onToggle,
  onRename,
  onRemove,
}: {
  todo: Todo
  onToggle: () => void
  onRename: (title: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.title)

  const commit = () => {
    const title = draft.trim()
    if (title) onRename(title)
    else onRemove()
    setEditing(false)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') {
      setDraft(todo.title)
      setEditing(false)
    }
  }

  return (
    <li className={`item${todo.completed ? ' done' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={onToggle}
        aria-label={`Mark "${todo.title}" ${todo.completed ? 'not done' : 'done'}`}
      />
      {editing ? (
        <input
          className="edit"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
      ) : (
        <span
          className="title"
          onDoubleClick={() => {
            setDraft(todo.title)
            setEditing(true)
          }}
          title="Double-click to edit"
        >
          {todo.title}
        </span>
      )}
      <button className="remove" onClick={onRemove} aria-label={`Delete "${todo.title}"`}>
        ×
      </button>
    </li>
  )
}

export default function App({ onLock }: { onLock: () => void }) {
  const { todos, loading, error, add, toggle, rename, remove, clearCompleted, toggleAll } =
    useTodos(onLock)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    add(title)
    setText('')
  }

  const visible = todos.filter((t) =>
    filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed,
  )
  const left = todos.filter((t) => !t.completed).length
  const doneCount = todos.length - left

  return (
    <main className="app">
      <header className="header">
        <h1>Todos</h1>
        <button className="lock" onClick={onLock}>
          Lock
        </button>
      </header>

      <form className="new" onSubmit={submit}>
        {todos.length > 0 && (
          <button
            type="button"
            className="toggle-all"
            onClick={toggleAll}
            aria-label="Toggle all"
            title="Toggle all"
          >
            ✓
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What needs doing?"
          autoFocus
        />
        <button type="submit" className="add">
          Add
        </button>
      </form>

      {error && (
        <p className="auth-error banner" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : todos.length === 0 ? (
        <p className="empty">Nothing here yet. Add your first todo above.</p>
      ) : (
        <>
          <ul className="list">
            {visible.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={() => toggle(t.id)}
                onRename={(title) => rename(t.id, title)}
                onRemove={() => remove(t.id)}
              />
            ))}
            {visible.length === 0 && <li className="empty">No {filter} todos.</li>}
          </ul>

          <footer className="footer">
            <span>
              {left} item{left === 1 ? '' : 's'} left
            </span>
            <div className="filters">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button className="clear" onClick={clearCompleted} disabled={doneCount === 0}>
              Clear completed
            </button>
          </footer>
        </>
      )}
    </main>
  )
}
