import { useEffect, useState } from 'react'
import type { RecurringTransaction } from '../types'

interface Props {
  open: boolean
  rule: RecurringTransaction | undefined
  originalDate: string
  onSave: (data: { date: string; amount: number; notes: string | null }) => Promise<void>
  onClose: () => void
}

export default function InstanceEditModal({ open, rule, originalDate, onSave, onClose }: Props) {
  const [date, setDate] = useState(originalDate)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !rule) return
    setDate(originalDate)
    setAmount(String(rule.amount))
    setNotes('')
    setError('')
  }, [open, rule, originalDate])

  if (!open || !rule) return null

  const handleSave = async () => {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Amount must be a positive number')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Invalid date')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ date, amount: parsed, notes: notes.trim() || null })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
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
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Edit Instance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-gray-800 dark:text-gray-100">{rule.name}</span>
            <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">
              {rule.type === 'deposit' ? 'Deposit' : 'Expense'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            Changes affect only this one occurrence. The series is not modified.
          </p>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Amount">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={INPUT_CLS}
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save instance'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</span>
      {children}
    </label>
  )
}

const INPUT_CLS = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'
