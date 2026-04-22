import type { AdhocTransaction, RecurringTransaction } from '../types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NTH = ['', '1st', '2nd', '3rd', '4th', '5th', '', '', '', '', '', '', 'Last']

function describeRule(r: RecurringTransaction): string {
  switch (r.recurrence_type) {
    case 'monthly_fixed':
      return `Every month on the ${ordinal(r.day_of_month ?? 1)}`
    case 'weekly':
      return `Every ${DOW[r.day_of_week ?? 0]}`
    case 'biweekly':
      return `Every other ${DOW[r.day_of_week ?? 0]}`
    case 'yearly':
      return `Every ${MONTHS_SHORT[(r.month ?? 1) - 1]} ${ordinal(r.day_of_month ?? 1)}`
    case 'monthly_nth_weekday': {
      const nthLabel = r.nth_week === -1 ? 'Last' : NTH[r.nth_week ?? 1]
      return `${nthLabel} ${DOW[r.day_of_week ?? 0]} of every month`
    }
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  open: boolean
  recurring: RecurringTransaction[]
  adhoc: AdhocTransaction[]
  onEdit: (r: RecurringTransaction) => void
  onDelete: (id: string) => void
  onEditAdhoc: (t: AdhocTransaction) => void
  onDeleteAdhoc: (id: string) => void
  onClose: () => void
}

export default function RecurringList({ open, recurring, adhoc, onEdit, onDelete, onEditAdhoc, onDeleteAdhoc, onClose }: Props) {
  if (!open) return null

  const recurringDeposits = recurring.filter((r) => r.type === 'deposit')
  const recurringExpenses = recurring.filter((r) => r.type === 'expense')
  const adhocDeposits = adhoc.filter((t) => t.type === 'deposit')
  const adhocExpenses = adhoc.filter((t) => t.type === 'expense')

  const hasAnything = recurring.length > 0 || adhoc.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 h-full w-full max-w-sm shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {!hasAnything && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">
            No transactions scheduled.
          </p>
        )}

        {(recurringDeposits.length > 0 || recurringExpenses.length > 0) && (
          <div>
            <div className="px-5 pt-4 pb-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Recurring</h4>
            </div>
            {recurringDeposits.length > 0 && (
              <RecurringSection title="Deposits" items={recurringDeposits} onEdit={onEdit} onDelete={onDelete} />
            )}
            {recurringExpenses.length > 0 && (
              <RecurringSection title="Expenses" items={recurringExpenses} onEdit={onEdit} onDelete={onDelete} />
            )}
          </div>
        )}

        {(adhocDeposits.length > 0 || adhocExpenses.length > 0) && (
          <div>
            <div className="px-5 pt-4 pb-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">One-time</h4>
            </div>
            {adhocDeposits.length > 0 && (
              <AdhocSection title="Deposits" items={adhocDeposits} onEdit={onEditAdhoc} onDelete={onDeleteAdhoc} />
            )}
            {adhocExpenses.length > 0 && (
              <AdhocSection title="Expenses" items={adhocExpenses} onEdit={onEditAdhoc} onDelete={onDeleteAdhoc} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RecurringSection({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: RecurringTransaction[]
  onEdit: (r: RecurringTransaction) => void
  onDelete: (id: string) => void
}) {
  const isDeposit = title === 'Deposits'
  return (
    <div className="px-5 py-3">
      <h5 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
        {title}
      </h5>
      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{r.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{describeRule(r)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-sm font-mono font-semibold ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
                {isDeposit ? '+' : '-'}${fmt(r.amount)}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(r)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AdhocSection({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: AdhocTransaction[]
  onEdit: (t: AdhocTransaction) => void
  onDelete: (id: string) => void
}) {
  const isDeposit = title === 'Deposits'
  return (
    <div className="px-5 py-3">
      <h5 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
        {title}
      </h5>
      <ul className="flex flex-col gap-3">
        {items.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between gap-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{t.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(t.date)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-sm font-mono font-semibold ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
                {isDeposit ? '+' : '-'}${fmt(t.amount)}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(t)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
