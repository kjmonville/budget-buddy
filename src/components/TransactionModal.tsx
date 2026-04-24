import { useEffect, useState } from 'react'
import type { AdhocTransaction, RecurrenceType, RecurringTransaction, TransactionType } from '../types'

const DAYS_OF_WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const NTH_LABELS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last']
const NTH_VALUES = [1, 2, 3, 4, 5, -1]

interface Props {
  open: boolean
  initialDate?: string
  editRecurring?: RecurringTransaction
  editAdhoc?: AdhocTransaction
  onSaveRecurring: (data: Omit<RecurringTransaction, 'id' | 'active' | 'created_at'>) => Promise<void>
  onSaveAdhoc: (data: Omit<AdhocTransaction, 'id' | 'created_at'>) => Promise<void>
  onUpdateAdhoc?: (data: Omit<AdhocTransaction, 'id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

type Mode = 'recurring' | 'one-time'

const DEFAULT_RECURRING: Omit<RecurringTransaction, 'id' | 'active' | 'created_at'> = {
  type: 'expense',
  name: '',
  amount: 0,
  recurrence_type: 'monthly_fixed',
  day_of_month: 1,
  month: null,
  day_of_week: null,
  nth_week: null,
  biweekly_anchor: null,
  notes: null,
}

export default function TransactionModal({
  open,
  initialDate,
  editRecurring,
  editAdhoc,
  onSaveRecurring,
  onSaveAdhoc,
  onUpdateAdhoc,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>('recurring')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Recurring form state
  const [rType, setRType] = useState<TransactionType>(editRecurring?.type ?? 'expense')
  const [rName, setRName] = useState(editRecurring?.name ?? '')
  const [rAmount, setRAmount] = useState(editRecurring ? String(editRecurring.amount) : '')
  const [rRecType, setRRecType] = useState<RecurrenceType>(editRecurring?.recurrence_type ?? 'monthly_fixed')
  const [rDayOfMonth, setRDayOfMonth] = useState(editRecurring?.day_of_month ?? 1)
  const [rMonth, setRMonth] = useState(editRecurring?.month ?? 1)
  const [rDayOfWeek, setRDayOfWeek] = useState(editRecurring?.day_of_week ?? 5)
  const [rNthWeek, setRNthWeek] = useState(editRecurring?.nth_week ?? 1)
  const [rAnchor, setRAnchor] = useState(editRecurring?.biweekly_anchor ?? '')

  // Recurring notes state
  const [rNotes, setRNotes] = useState(editRecurring?.notes ?? '')

  // One-time form state
  const [aType, setAType] = useState<TransactionType>('expense')
  const [aName, setAName] = useState('')
  const [aAmount, setAAmount] = useState('')
  const [aDate, setADate] = useState(initialDate ?? new Date().toISOString().slice(0, 10))
  const [aNotes, setANotes] = useState(editAdhoc?.notes ?? '')

  useEffect(() => {
    if (!open) return
    setError('')

    if (editAdhoc) {
      setMode('one-time')
      setAType(editAdhoc.type)
      setAName(editAdhoc.name)
      setAAmount(String(editAdhoc.amount))
      setADate(editAdhoc.date)
      setANotes(editAdhoc.notes ?? '')
      return
    }

    setMode('recurring')

    // Reset recurring fields — populate from editRecurring or clear
    setRType(editRecurring?.type ?? 'expense')
    setRName(editRecurring?.name ?? '')
    setRAmount(editRecurring ? String(editRecurring.amount) : '')
    setRRecType(editRecurring?.recurrence_type ?? 'monthly_fixed')
    const dayFromDate = initialDate ? Number(initialDate.split('-')[2]) : 1
    setRDayOfMonth(editRecurring?.day_of_month ?? dayFromDate)
    setRMonth(editRecurring?.month ?? 1)
    setRDayOfWeek(editRecurring?.day_of_week ?? 5)
    setRNthWeek(editRecurring?.nth_week ?? 1)
    setRAnchor(editRecurring?.biweekly_anchor ?? '')
    setRNotes(editRecurring?.notes ?? '')

    // Reset one-time fields
    setAType('expense')
    setAName('')
    setAAmount('')
    setADate(initialDate ?? new Date().toISOString().slice(0, 10))
    setANotes('')
  }, [open, initialDate, editRecurring, editAdhoc])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (mode === 'recurring') {
        const amt = parseFloat(rAmount)
        if (!rName.trim()) throw new Error('Name is required')
        if (isNaN(amt) || amt <= 0) throw new Error('Amount must be a positive number')

        const data: Omit<RecurringTransaction, 'id' | 'active' | 'created_at'> = {
          ...DEFAULT_RECURRING,
          type: rType,
          name: rName.trim(),
          amount: amt,
          recurrence_type: rRecType,
          day_of_month: ['monthly_fixed', 'yearly'].includes(rRecType) ? rDayOfMonth : null,
          month: rRecType === 'yearly' ? rMonth : null,
          day_of_week: ['weekly', 'biweekly', 'monthly_nth_weekday'].includes(rRecType) ? rDayOfWeek : null,
          nth_week: rRecType === 'monthly_nth_weekday' ? rNthWeek : null,
          biweekly_anchor: rRecType === 'biweekly' ? rAnchor || null : null,
          notes: rNotes.trim() || null,
        }
        await onSaveRecurring(data)
      } else {
        const amt = parseFloat(aAmount)
        if (!aName.trim()) throw new Error('Name is required')
        if (isNaN(amt) || amt <= 0) throw new Error('Amount must be a positive number')
        if (!aDate) throw new Error('Date is required')
        const adhocData = { type: aType, name: aName.trim(), amount: amt, date: aDate, notes: aNotes.trim() || null }
        if (editAdhoc && onUpdateAdhoc) {
          await onUpdateAdhoc(adhocData)
        } else {
          await onSaveAdhoc(adhocData)
        }
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">
            {editRecurring ? 'Edit Recurring Transaction' : editAdhoc ? 'Edit One-time Transaction' : 'Add Transaction'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        {/* Mode tabs (only for new transactions) */}
        {!editRecurring && !editAdhoc && (
          <div className="flex border-b dark:border-gray-700">
            {(['recurring', 'one-time'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  'flex-1 py-2.5 text-sm font-medium capitalize transition-colors',
                  mode === m
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 flex flex-col gap-4">
          {mode === 'recurring' ? (
            <>
              {/* Type */}
              <TypeToggle value={rType} onChange={setRType} />
              {/* Name */}
              <Field label="Name">
                <input
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="e.g. Rent, Paycheck"
                  className={INPUT_CLS}
                />
              </Field>
              {/* Amount */}
              <Field label="Amount">
                <AmountInput value={rAmount} onChange={setRAmount} />
              </Field>
              {/* Recurrence type */}
              <Field label="Repeats">
                <select
                  value={rRecType}
                  onChange={(e) => setRRecType(e.target.value as RecurrenceType)}
                  className={INPUT_CLS}
                >
                  <option value="monthly_fixed">Monthly — fixed day</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="yearly">Yearly</option>
                  <option value="monthly_nth_weekday">Monthly — nth weekday</option>
                </select>
              </Field>

              {/* Conditional fields */}
              {(rRecType === 'monthly_fixed') && (
                <Field label="Day of month">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={rDayOfMonth}
                    onChange={(e) => setRDayOfMonth(Number(e.target.value))}
                    className={INPUT_CLS}
                  />
                </Field>
              )}
              {rRecType === 'yearly' && (
                <>
                  <Field label="Month">
                    <select value={rMonth} onChange={(e) => setRMonth(Number(e.target.value))} className={INPUT_CLS}>
                      {MONTHS_LABELS.map((lbl, i) => (
                        <option key={i} value={i + 1}>{lbl}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Day">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={rDayOfMonth}
                      onChange={(e) => setRDayOfMonth(Number(e.target.value))}
                      className={INPUT_CLS}
                    />
                  </Field>
                </>
              )}
              {(rRecType === 'weekly' || rRecType === 'biweekly' || rRecType === 'monthly_nth_weekday') && (
                <Field label="Day of week">
                  <select value={rDayOfWeek} onChange={(e) => setRDayOfWeek(Number(e.target.value))} className={INPUT_CLS}>
                    {DAYS_OF_WEEK_LABELS.map((lbl, i) => (
                      <option key={i} value={i}>{lbl}</option>
                    ))}
                  </select>
                </Field>
              )}
              {rRecType === 'biweekly' && (
                <Field label="Starting date">
                  <input
                    type="date"
                    value={rAnchor}
                    onChange={(e) => setRAnchor(e.target.value)}
                    className={INPUT_CLS}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Pick any past occurrence of this transaction</p>
                </Field>
              )}
              {rRecType === 'monthly_nth_weekday' && (
                <Field label="Which occurrence">
                  <select value={rNthWeek} onChange={(e) => setRNthWeek(Number(e.target.value))} className={INPUT_CLS}>
                    {NTH_LABELS.map((lbl, i) => (
                      <option key={i} value={NTH_VALUES[i]}>{lbl}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Notes">
                <textarea
                  rows={2}
                  value={rNotes}
                  onChange={(e) => setRNotes(e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </>
          ) : (
            <>
              <TypeToggle value={aType} onChange={setAType} />
              <Field label="Name">
                <input
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  placeholder="e.g. Grocery run"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Amount">
                <AmountInput value={aAmount} onChange={setAAmount} />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={aDate}
                  onChange={(e) => setADate(e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={2}
                  value={aNotes}
                  onChange={(e) => setANotes(e.target.value)}
                  className={INPUT_CLS}
                />
              </Field>
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : (editRecurring || editAdhoc) ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}

const INPUT_CLS = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function TypeToggle({ value, onChange }: { value: TransactionType; onChange: (v: TransactionType) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
      {(['expense', 'deposit'] as TransactionType[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={[
            'flex-1 py-2 text-sm font-medium capitalize transition-colors',
            value === t
              ? t === 'expense'
                ? 'bg-red-500 text-white'
                : 'bg-emerald-500 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600',
          ].join(' ')}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="pl-7 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}
