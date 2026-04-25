import type { DayBalance, TxEntry } from '../types'
import CalendarDay from './CalendarDay'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  year: number
  month: number // 1-indexed
  balances: Record<string, DayBalance>
  onDayClick: (date: string) => void
  onToggleSkip: (entry: TxEntry, date: string) => void
  onEdit: (entry: TxEntry) => void
  onDelete: (entry: TxEntry) => void
  onPrev: () => void
  onNext: () => void
}

export default function CalendarView({
  year,
  month,
  balances,
  onDayClick,
  onToggleSkip,
  onEdit,
  onDelete,
  onPrev,
  onNext,
}: Props) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()

  const pad = (n: number) => String(n).padStart(2, '0')

  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7
  const cells: Array<{ date: string; day: number; inMonth: boolean }> = []

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstDow + 1
    if (dayOffset < 1 || dayOffset > daysInMonth) {
      const d = new Date(year, month - 1, dayOffset)
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      cells.push({ date: dateStr, day: d.getDate(), inMonth: false })
    } else {
      const dateStr = `${year}-${pad(month)}-${pad(dayOffset)}`
      cells.push({ date: dateStr, day: dayOffset, inMonth: true })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onPrev}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {MONTHS[month - 1]} {year}
        </h2>
        <button
          onClick={onNext}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {DAYS_OF_WEEK.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, day, inMonth }) => (
          <CalendarDay
            key={date}
            date={date}
            day={day}
            data={balances[date]}
            isCurrentMonth={inMonth}
            onClick={onDayClick}
            onToggleSkip={onToggleSkip}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
