import type { AdhocTransaction, DayBalance, RecurringTransaction, SkippedOccurrence, TxEntry } from '../types'
import { expandRecurring } from './recurrence'

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

  // Build fast skip lookup: "transactionId|date" → skipped_occurrences.id
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

export function computeAllDailyBalances(
  startBalance: number,
  startDate: string,
  recurring: RecurringTransaction[],
  adhoc: AdhocTransaction[],
  skipped: SkippedOccurrence[],
  fromDate: string,
  toDate: string
): Record<string, DayBalance> {
  const txMap = buildTxMap(recurring, adhoc, skipped, fromDate, toDate)

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
    const net = deposits.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
             - expenses.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
    fwdBal += net
    result[date] = { deposits, expenses, endBalance: fwdBal, isToday: date === startDate, isPast: false }
  }

  // Backward pass: from day before startDate down to fromDate
  // B(d-1) = B(d) - D(d) + E(d); anchor is B(startDate - 1) = startBalance
  let bwdBal = startBalance
  for (let i = allDates.indexOf(startDate) - 1; i >= 0; i--) {
    const date = allDates[i]
    const { deposits, expenses } = txMap.get(date) ?? { deposits: [], expenses: [] }
    result[date] = { deposits, expenses, endBalance: bwdBal, isToday: false, isPast: true }
    bwdBal = bwdBal
      - deposits.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
      + expenses.filter(t => !t.skipped).reduce((s, t) => s + t.amount, 0)
  }

  return result
}
