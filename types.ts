export type Todo = {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

export type Filter = 'all' | 'active' | 'completed'
