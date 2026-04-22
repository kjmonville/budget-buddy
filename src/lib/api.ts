import type {
  AccountBalance,
  AdhocTransaction,
  RecurringTransaction,
  SkippedOccurrence,
} from '../types'

const BASE = '/api'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: undefined })) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Balance
export const getBalance = () =>
  request<AccountBalance>('/balance')

export const setBalance = (amount: number, balance_date: string) =>
  request<{ ok: boolean }>('/balance', {
    method: 'PUT',
    body: JSON.stringify({ amount, balance_date }),
  })

// Recurring transactions
export const getRecurring = () =>
  request<RecurringTransaction[]>('/recurring')

export const createRecurring = (data: Omit<RecurringTransaction, 'id' | 'active' | 'created_at'>) =>
  request<RecurringTransaction>('/recurring', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateRecurring = (
  id: string,
  data: Partial<Omit<RecurringTransaction, 'id' | 'active' | 'created_at'>>
) =>
  request<RecurringTransaction>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteRecurring = (id: string) =>
  request<{ ok: boolean }>(`/recurring/${id}`, { method: 'DELETE' })

// Ad-hoc transactions
export const getAdhoc = () =>
  request<AdhocTransaction[]>('/adhoc')

export const createAdhoc = (data: Omit<AdhocTransaction, 'id' | 'created_at'>) =>
  request<AdhocTransaction>('/adhoc', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateAdhoc = (id: string, data: Omit<AdhocTransaction, 'id' | 'created_at'>) =>
  request<AdhocTransaction>(`/adhoc/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteAdhoc = (id: string) =>
  request<{ ok: boolean }>(`/adhoc/${id}`, { method: 'DELETE' })

// Skipped occurrences
export const getSkipped = () =>
  request<SkippedOccurrence[]>('/skipped')

export const skipOccurrence = (transaction_id: string, transaction_type: 'recurring' | 'adhoc', date: string) =>
  request<SkippedOccurrence>('/skipped', {
    method: 'POST',
    body: JSON.stringify({ transaction_id, transaction_type, date }),
  })

export const unskipOccurrence = (id: string) =>
  request<{ ok: boolean }>(`/skipped/${id}`, { method: 'DELETE' })
