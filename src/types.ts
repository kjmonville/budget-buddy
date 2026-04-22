export interface User {
  id: string
  email: string
}

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
  cutoff_date: string | null
}

export interface TxEntry {
  id: string
  name: string
  amount: number
  source: 'recurring' | 'adhoc'
  skipped: boolean
  skippedId: string | null
}

export interface SkippedOccurrence {
  id: string
  transaction_id: string
  transaction_type: 'recurring' | 'adhoc'
  date: string
  created_at: string
}

export interface DayBalance {
  deposits: TxEntry[]
  expenses: TxEntry[]
  endBalance: number | null
  isToday: boolean
  isPast: boolean
}
