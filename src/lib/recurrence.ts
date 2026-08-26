import type { RecurringTransaction } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Returns all YYYY-MM-DD date strings when a recurring rule fires
 * within the given calendar month (1-indexed month).
 */
export function expandRecurring(
  rule: RecurringTransaction,
  year: number,
  month: number
): string[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const dateStr = (d: number) => `${year}-${pad(month)}-${pad(d)}`

  switch (rule.recurrence_type) {
    case 'monthly_fixed': {
      if (rule.day_of_month == null) return []
      const day = Math.min(rule.day_of_month, daysInMonth)
      return [dateStr(day)]
    }

    case 'weekly': {
      if (rule.day_of_week == null) return []
      const firstDow = new Date(year, month - 1, 1).getDay()
      const startDay = ((rule.day_of_week - firstDow + 7) % 7) + 1
      const result: string[] = []
      for (let d = startDay; d <= daysInMonth; d += 7) {
        result.push(dateStr(d))
      }
      return result
    }

    case 'biweekly': {
      if (rule.day_of_week == null || rule.biweekly_anchor == null) return []
      // anchor must be a valid YYYY-MM-DD on the correct day of week
      const anchor = new Date(rule.biweekly_anchor + 'T00:00:00')
      const firstDow = new Date(year, month - 1, 1).getDay()
      const startDay = ((rule.day_of_week - firstDow + 7) % 7) + 1
      const result: string[] = []
      for (let d = startDay; d <= daysInMonth; d += 7) {
        const candidate = new Date(year, month - 1, d)
        const diffDays = Math.round(
          (candidate.getTime() - anchor.getTime()) / 86_400_000
        )
        if (diffDays % 14 === 0) result.push(dateStr(d))
      }
      return result
    }

    case 'yearly': {
      if (rule.month == null || rule.day_of_month == null) return []
      if (rule.month !== month) return []
      const day = Math.min(rule.day_of_month, daysInMonth)
      return [dateStr(day)]
    }

    case 'monthly_nth_weekday': {
      if (rule.day_of_week == null || rule.nth_week == null) return []
      const firstDow = new Date(year, month - 1, 1).getDay()
      const startDay = ((rule.day_of_week - firstDow + 7) % 7) + 1
      const occurrences: number[] = []
      for (let d = startDay; d <= daysInMonth; d += 7) {
        occurrences.push(d)
      }
      if (rule.nth_week === -1) {
        const last = occurrences.at(-1)
        return last != null ? [dateStr(last)] : []
      }
      const idx = rule.nth_week - 1
      return occurrences[idx] != null ? [dateStr(occurrences[idx])] : []
    }
  }
}

/**
 * Returns the 1-based occurrence number of `date` for this rule, counting
 * every firing from `rule.start_date` (inclusive) through `date` (inclusive).
 * Requires `rule.start_date` to be set — without an anchor there's no
 * well-defined "1st occurrence" to count from. Returns 0 if `date` isn't
 * on/after the start date.
 */
export function countOccurrencesThrough(
  rule: RecurringTransaction,
  date: string
): number {
  if (!rule.start_date || date < rule.start_date) return 0
  const [startY, startM] = rule.start_date.split('-').map(Number)
  const [toY, toM] = date.split('-').map(Number)

  let count = 0
  let y = startY, m = startM
  while (y < toY || (y === toY && m <= toM)) {
    for (const d of expandRecurring(rule, y, m)) {
      if (d >= rule.start_date && d <= date) count++
    }
    m++
    if (m > 12) { m = 1; y++ }
  }
  return count
}
