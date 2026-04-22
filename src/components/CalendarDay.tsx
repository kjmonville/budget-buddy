import type { DayBalance, TxEntry } from '../types'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  date: string
  day: number
  data: DayBalance | undefined
  isCurrentMonth: boolean
  onClick: (date: string) => void
  onToggleSkip: (entry: TxEntry, date: string) => void
}

export default function CalendarDay({ date, day, data, isCurrentMonth, onClick, onToggleSkip }: Props) {
  const isToday = data?.isToday ?? false
  const isPast = data?.isPast ?? (!data && !isCurrentMonth)
  const balance = data?.endBalance ?? null
  const negative = balance != null && balance < 0
  const hasTransactions = (data?.deposits.length ?? 0) + (data?.expenses.length ?? 0) > 0

  return (
    <div
      onClick={() => isCurrentMonth && onClick(date)}
      className={[
        'min-h-[96px] p-1.5 border border-gray-100 dark:border-gray-700 flex flex-col',
        isCurrentMonth ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900',
        isToday ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50 dark:bg-indigo-900/30' : '',
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
          isToday ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400',
        ].join(' ')}
      >
        {day}
      </span>

      {/* Transactions */}
      {isCurrentMonth && hasTransactions && (
        <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
          {data!.deposits.map((t) => (
            <TxBadge key={t.id} entry={t} date={date} isDeposit onToggleSkip={onToggleSkip} />
          ))}
          {data!.expenses.map((t) => (
            <TxBadge key={t.id} entry={t} date={date} isDeposit={false} onToggleSkip={onToggleSkip} />
          ))}
        </div>
      )}

      {/* End-of-day balance */}
      {isCurrentMonth && balance != null && (
        <div
          className={[
            'mt-auto text-[11px] font-mono font-medium text-right leading-none pt-1',
            negative ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300',
          ].join(' ')}
        >
          {negative ? '-' : ''}${fmt(Math.abs(balance))}
        </div>
      )}
    </div>
  )
}

function TxBadge({
  entry,
  date,
  isDeposit,
  onToggleSkip,
}: {
  entry: TxEntry
  date: string
  isDeposit: boolean
  onToggleSkip: (entry: TxEntry, date: string) => void
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggleSkip(entry, date) }}
      title={entry.skipped ? 'Click to re-enable' : 'Click to mark complete'}
      className={[
        'text-[10px] leading-tight rounded px-1 flex justify-between gap-1 cursor-pointer select-none',
        entry.skipped
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 line-through'
          : isDeposit
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
            : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60',
      ].join(' ')}
    >
      <span className="truncate">{isDeposit ? '+' : '-'}{entry.name}</span>
      <span className="font-mono shrink-0">{fmt(entry.amount)}</span>
    </div>
  )
}
