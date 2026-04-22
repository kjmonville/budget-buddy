import type { RecurringTransaction } from '../types'


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

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  open: boolean
  recurring: RecurringTransaction[]
  onEdit: (r: RecurringTransaction) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function RecurringList({ open, recurring, onEdit, onDelete, onClose }: Props) {
  if (!open) return null

  const deposits = recurring.filter((r) => r.type === 'deposit')
  const expenses = recurring.filter((r) => r.type === 'expense')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-sm shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">Recurring Transactions</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {recurring.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            No recurring transactions yet.
          </p>
        )}

        {deposits.length > 0 && (
          <Section title="Deposits" items={deposits} onEdit={onEdit} onDelete={onDelete} />
        )}
        {expenses.length > 0 && (
          <Section title="Expenses" items={expenses} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>
    </div>
  )
}

function Section({
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
    <div className="px-5 py-4">
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
        {title}
      </h4>
      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-2 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm truncate">{r.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{describeRule(r)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span
                className={`text-sm font-mono font-semibold ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {isDeposit ? '+' : '-'}${fmt(r.amount)}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(r)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(r.id)}
                  className="text-xs px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
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
