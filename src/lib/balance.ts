import type { AdhocTransaction, DayBalance, RecurringTransaction, SkippedOccurrence, TxEntry } from '../types'
import { expandRecurring } from './recurrence'

export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildTxMap(
  recurring: RecurringTransaction[],
  adhoc: AdhocTransaction[],
  skipped: SkippedOccurrence[],
  fromDate: string,
  toDate: string
): Map<string, { deposits: TxEntry[]; expenses: TxEntry[] }> {
  const map = new Map<string, { deposits: TxEntry[]; expenses: TxEntry[] }>()

  const ensure = (date: string) => {
    if (!map.has(date)) map.set(date, { deposits: [], expenses: [] })
    return map.get(date)!
  }

  const skipMap = new Map<string, string>()
  for (const s of skipped) {
    skipMap.set(`${s.transaction_id}|${s.date}`, s.id)
  }

  const [fromY, fromM] = fromDate.split('-').map(Number)
  const [toY, toM] = toDate.split('-').map(Number)

  let y = fromY, m = fromM
  while (y < toY || (y === toY && m <= toM)) {
    for (const rule of recurring) {
      if (!rule.active) continue
      for (const date of expandRecurring(rule, y, m)) {
        if (date < fromDate || date > toDate) continue
        const skippedId = skipMap.get(`${rule.id}|${date}`) ?? null
        const day = ensure(date)
        const entry: TxEntry = { id: rule.id, name: rule.name, amount: rule.amount, source: 'recurring', skipped: skippedId !== null, skippedId }
        if (rule.type === 'deposit') day.deposits.push(entry)
        else day.expenses.push(entry)
      }
    }
    m++
    if (m > 12) { m = 1; y++ }
  }

  for (const tx of adhoc) {
    if (tx.date < fromDate || tx.date > toDate) continue
    const skippedId = skipMap.get(`${tx.id}|${tx.date}`) ?? null
    const day = ensure(tx.date)
    const entry: TxEntry = { id: tx.id, name: tx.name, amount: tx.amount, source: 'adhoc', skipped: skippedId !== null, skippedId }
    if (tx.type === 'deposit') day.deposits.push(entry)
    else day.expenses.push(entry)
  }

  return map
}

/**
 * startBalance = actual bank balance as of startDate (reflects only cleared/completed transactions).
 * cutoffDate   = first day of first month the tool was used; transactions before this are ignored.
 *
 * Past days (before today): show transaction badges but no balance number.
 * Today and future: project balance forward using all uncompleted transactions.
 * The adjustment accounts for uncompleted transactions between cutoffDate and startDate-1
 * so they are factored into today's opening balance.
 */
export function computeAllDailyBalances(
  startBalance: number,
  startDate: string,
  recurring: RecurringTransaction[],
  adhoc: AdhocTransaction[],
  skipped: SkippedOccurrence[],
  cutoffDate: string,
  fromDate: string,
  toDate: string
): Record<string, DayBalance> {
  const todayStr = localDateStr()

  // Build tx map only from cutoffDate onwards — pre-cutoff transactions are ignored
  const txMap = buildTxMap(recurring, adhoc, skipped, cutoffDate, toDate)

  const allDates: string[] = []
  const cur = new Date(fromDate + 'T00:00:00')
  const end = new Date(toDate + 'T00:00:00')
  while (cur <= end) {
    allDates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  const result: Record<string, DayBalance> = {}

  // Adjustment: sum uncompleted transactions from cutoffDate up to (but not including) startDate.
  // These haven't cleared the bank yet, so they aren't in startBalance.
  let adjustment = 0
  for (const date of allDates) {
    if (date < cutoffDate || date >= startDate) continue
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    adjustment += deposits.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
    adjustment -= expenses.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
  }

  // Forward pass from startDate: project balance using uncompleted transactions.
  // Days before today get endBalance: null (display badges only, no balance shown).
  let fwdBal = startBalance + adjustment
  for (const date of allDates) {
    if (date < startDate) continue
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    const net = deposits.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
             - expenses.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
    fwdBal += net
    const isPast = date < todayStr
    result[date] = {
      deposits,
      expenses,
      endBalance: isPast ? null : fwdBal,
      isToday: date === todayStr,
      isPast,
    }
  }

  // Past days from cutoffDate to startDate-1: show badges but no balance
  for (const date of allDates) {
    if (date < cutoffDate || date >= startDate) continue
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    result[date] = { deposits, expenses, endBalance: null, isToday: false, isPast: true }
  }

  return result
}
