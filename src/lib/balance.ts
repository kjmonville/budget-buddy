import type { AdhocTransaction, DayBalance, RecurringTransaction } from '../types'
import { expandRecurring } from './recurrence'

type TxEntry = { id: string; name: string; amount: number }

function buildTxMap(
  recurring: RecurringTransaction[],
  adhoc: AdhocTransaction[],
  fromDate: string,
  toDate: string
): Map<string, { deposits: TxEntry[]; expenses: TxEntry[] }> {
  const map = new Map<string, { deposits: TxEntry[]; expenses: TxEntry[] }>()

  const ensure = (date: string) => {
    if (!map.has(date)) map.set(date, { deposits: [], expenses: [] })
    return map.get(date)!
  }

  // Determine month range to expand
  const [fromY, fromM] = fromDate.split('-').map(Number)
  const [toY, toM] = toDate.split('-').map(Number)

  let y = fromY, m = fromM
  while (y < toY || (y === toY && m <= toM)) {
    for (const rule of recurring) {
      if (!rule.active) continue
      for (const date of expandRecurring(rule, y, m)) {
        if (date < fromDate || date > toDate) continue
        const day = ensure(date)
        const entry = { id: rule.id, name: rule.name, amount: rule.amount }
        if (rule.type === 'deposit') day.deposits.push(entry)
        else day.expenses.push(entry)
      }
    }
    m++
    if (m > 12) { m = 1; y++ }
  }

  for (const tx of adhoc) {
    if (tx.date < fromDate || tx.date > toDate) continue
    const day = ensure(tx.date)
    const entry = { id: tx.id, name: tx.name, amount: tx.amount }
    if (tx.type === 'deposit') day.deposits.push(entry)
    else day.expenses.push(entry)
  }

  return map
}

/**
 * Computes end-of-day balances for every day between fromDate and toDate.
 *
 * startBalance = the bank balance at the START of startDate (before that day's transactions).
 * startDate    = the anchor date for startBalance (typically today).
 */
export function computeAllDailyBalances(
  startBalance: number,
  startDate: string,
  recurring: RecurringTransaction[],
  adhoc: AdhocTransaction[],
  fromDate: string,
  toDate: string
): Record<string, DayBalance> {
  const txMap = buildTxMap(recurring, adhoc, fromDate, toDate)

  // Enumerate all dates in range
  const allDates: string[] = []
  const cur = new Date(fromDate + 'T00:00:00')
  const end = new Date(toDate + 'T00:00:00')
  while (cur <= end) {
    allDates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  const result: Record<string, DayBalance> = {}

  // Forward pass: from startDate to toDate
  let fwdBal = startBalance
  let started = false
  for (const date of allDates) {
    if (date < startDate) continue
    if (!started) started = true
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    const net = deposits.reduce((s, t) => s + t.amount, 0) - expenses.reduce((s, t) => s + t.amount, 0)
    fwdBal += net
    result[date] = {
      deposits,
      expenses,
      endBalance: fwdBal,
      isToday: date === startDate,
      isPast: false,
    }
  }

  // Backward pass: from day before startDate down to fromDate
  // B(d-1) = B(d) - D(d) + E(d); our anchor is B(startDate - 1) = startBalance
  let bwdBal = startBalance
  for (let i = allDates.indexOf(startDate) - 1; i >= 0; i--) {
    const date = allDates[i]
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    // bwdBal is end-of-day for this date
    result[date] = {
      deposits,
      expenses,
      endBalance: bwdBal,
      isToday: false,
      isPast: true,
    }
    bwdBal = bwdBal - deposits.reduce((s, t) => s + t.amount, 0) + expenses.reduce((s, t) => s + t.amount, 0)
  }

  return result
}
