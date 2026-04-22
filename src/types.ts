export type TransactionType = 'deposit' | 'expense'

export type RecurrenceType =
  | 'monthly_fixed'
  | 'weekly'
  | 'biweekly'
  | 'yearly'
  | 'monthly_nth_weekday'

export interface RecurringTransaction {
  id: string
  type: TransactionType
  name: string
  amount: number
  recurrence_type: RecurrenceType
  day_of_month: number | null
  month: number | null
  day_of_week: number | null
  nth_week: number | null
  biweekly_anchor: string | null
  active: number
  created_at: string
}

export interface AdhocTransaction {
  id: string
  type: TransactionType
  name: string
  amount: number
  date: string
  created_at: string
}

export interface AccountBalance {
  amount: number
  balance_date: string | null
  updated_at: string | null
}

export interface DayBalance {
  deposits: Array<{ id: string; name: string; amount: number }>
  expenses: Array<{ id: string; name: string; amount: number }>
  endBalance: number
  isToday: boolean
  isPast: boolean
}
