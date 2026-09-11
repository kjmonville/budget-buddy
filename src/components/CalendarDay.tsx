import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent } from 'react'
import type { DayBalance, TxEntry } from '../types'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDay = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

// Half the tooltip's max width — keeps it clamped inside the viewport
const TIP_HALF_WIDTH = 130

interface Props {
  date: string
  day: number
  data: DayBalance | undefined
  isCurrentMonth: boolean
  onClick: (date: string) => void
  onToggleSkip: (entry: TxEntry, date: string) => void
  onTogglePaid: (entry: TxEntry, date: string) => void
  onEdit: (entry: TxEntry, date: string) => void
  onDelete: (entry: TxEntry, date: string) => void
}

export default function CalendarDay({ date, day, data, isCurrentMonth, onClick, onToggleSkip, onTogglePaid, onEdit, onDelete }: Props) {
  const isToday = data?.isToday ?? false
  const isPast = data?.isPast ?? (!data && !isCurrentMonth)
  const balance = data?.endBalance ?? null
  const negative = balance != null && balance < 0
  const hasTransactions = (data?.deposits.length ?? 0) + (data?.expenses.length ?? 0) > 0

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: TxEntry } | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

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
            <TxBadge
              key={t.id}
              entry={t}
              date={date}
              isDeposit
              isPast={isPast}
              isToday={isToday}
              onToggleSkip={onToggleSkip}
              onTogglePaid={onTogglePaid}
              onContextMenu={(entry, x, y) => setContextMenu({ x, y, entry })}
            />
          ))}
          {data!.expenses.map((t) => (
            <TxBadge
              key={t.id}
              entry={t}
              date={date}
              isDeposit={false}
              isPast={isPast}
              isToday={isToday}
              onToggleSkip={onToggleSkip}
              onTogglePaid={onTogglePaid}
              onContextMenu={(entry, x, y) => setContextMenu({ x, y, entry })}
            />
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

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
          className="z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setContextMenu(null); onEdit(contextMenu.entry, date) }}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Edit Instance
          </button>
          <button
            onClick={() => { setContextMenu(null); onDelete(contextMenu.entry, date) }}
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Delete Instance
          </button>
        </div>
      )}
    </div>
  )
}

function TxBadge({
  entry,
  date,
  isDeposit,
  isPast,
  isToday,
  onToggleSkip,
  onTogglePaid,
  onContextMenu,
}: {
  entry: TxEntry
  date: string
  isDeposit: boolean
  isPast: boolean
  isToday: boolean
  onToggleSkip: (entry: TxEntry, date: string) => void
  onTogglePaid: (entry: TxEntry, date: string) => void
  onContextMenu: (entry: TxEntry, x: number, y: number) => void
}) {
  const [tip, setTip] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const [overPaid, setOverPaid] = useState(false)

  const showTip = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const above = r.top > 140
    setTip({
      x: Math.min(
        Math.max(r.left + r.width / 2, TIP_HALF_WIDTH + 8),
        window.innerWidth - TIP_HALF_WIDTH - 8,
      ),
      y: above ? r.top - 6 : r.bottom + 6,
      above,
    })
  }

  const hideTip = () => { setTip(null); setOverPaid(false) }

  // What this occurrence means on this specific date
  const status = entry.skipped
    ? 'Cleared — not in the projection'
    : entry.paid
      ? 'Paid — not cleared yet'
      : isPast
        ? 'Not yet cleared'
        : isToday
          ? 'Due today'
          : 'Scheduled'

  const action = overPaid
    ? entry.paid ? 'Click the check to mark unpaid' : 'Click the check to mark paid'
    : entry.skipped ? 'Click to restore' : 'Click to clear'

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggleSkip(entry, date) }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); hideTip(); onContextMenu(entry, e.clientX, e.clientY) }}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      className={[
        'text-[10px] leading-tight rounded px-1 flex items-center gap-0.5 cursor-pointer select-none',
        entry.skipped
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 line-through'
          : entry.paid
            ? isDeposit
              ? 'bg-emerald-100/60 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/40'
              : 'bg-red-100/60 dark:bg-red-900/25 text-red-700 dark:text-red-400 hover:bg-red-200/60 dark:hover:bg-red-900/40'
            : isDeposit
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
              : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60',
      ].join(' ')}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePaid(entry, date) }}
        onMouseEnter={() => setOverPaid(true)}
        onMouseLeave={() => setOverPaid(false)}
        className="shrink-0 leading-none"
      >
        {entry.paid
          ? <span className="text-[9px]">✓</span>
          : <span className="text-[9px] opacity-30">○</span>
        }
      </button>
      <span className="truncate">
        {entry.name}
        {entry.occurrencesRemaining != null ? ` [${entry.occurrencesRemaining}]` : ''}
      </span>
      <span className="font-mono shrink-0">{isDeposit ? '+' : '-'}{fmt(entry.amount)}</span>

      {/* Hover detail — portalled so a faded past-day cell can't dim it */}
      {tip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tip.x,
            top: tip.y,
            transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`,
          }}
          className="z-50 pointer-events-none w-max max-w-[260px] rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 break-words">
              {entry.name}
              {entry.occurrencesRemaining != null ? ` [${entry.occurrencesRemaining}]` : ''}
            </span>
            <span
              className={[
                'ml-auto text-xs font-mono font-semibold shrink-0',
                isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              ].join(' ')}
            >
              {isDeposit ? '+' : '-'}${fmt(entry.amount)}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {formatDay(date)} · {status}
          </div>
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
            {action}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
