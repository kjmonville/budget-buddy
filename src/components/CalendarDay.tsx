import type { DayBalance } from '../types'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  date: string
  day: number
  data: DayBalance | undefined
  isCurrentMonth: boolean
  onClick: (date: string) => void
}

export default function CalendarDay({ date, day, data, isCurrentMonth, onClick }: Props) {
  const isToday = data?.isToday ?? false
  const isPast = data?.isPast ?? (!data && !isCurrentMonth)
  const balance = data?.endBalance ?? null
  const negative = balance != null && balance < 0
  const hasTransactions = (data?.deposits.length ?? 0) + (data?.expenses.length ?? 0) > 0

  return (
    <div
      onClick={() => isCurrentMonth && onClick(date)}
      className={[
        'min-h-[96px] p-1.5 border border-gray-100 flex flex-col',
        isCurrentMonth ? 'cursor-pointer hover:bg-indigo-50 transition-colors' : 'bg-gray-50',
        isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50' : '',
        isPast && isCurrentMonth ? 'opacity-60' : '',
        !isCurrentMonth ? 'opacity-30' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Day number */}
      <span
        className={[
          'text-xs font-semibold leading-none mb-1',
          isToday ? 'text-indigo-600' : 'text-gray-500',
        ].join(' ')}
      >
        {day}
      </span>

      {/* Transactions */}
      {isCurrentMonth && hasTransactions && (
        <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
          {data!.deposits.map((t) => (
            <div
              key={t.id}
              className="text-[10px] leading-tight bg-emerald-100 text-emerald-800 rounded px-1 flex justify-between gap-1"
              title={`${t.name} +$${fmt(t.amount)}`}
            >
              <span className="truncate">+{t.name}</span>
              <span className="font-mono shrink-0">{fmt(t.amount)}</span>
            </div>
          ))}
          {data!.expenses.map((t) => (
            <div
              key={t.id}
              className="text-[10px] leading-tight bg-red-100 text-red-800 rounded px-1 flex justify-between gap-1"
              title={`${t.name} -$${fmt(t.amount)}`}
            >
              <span className="truncate">-{t.name}</span>
              <span className="font-mono shrink-0">{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* End-of-day balance */}
      {isCurrentMonth && balance != null && (
        <div
          className={[
            'mt-auto text-[11px] font-mono font-medium text-right leading-none pt-1',
            negative ? 'text-red-600' : 'text-gray-700',
          ].join(' ')}
        >
          {negative ? '-' : ''}${fmt(Math.abs(balance))}
        </div>
      )}
    </div>
  )
}
