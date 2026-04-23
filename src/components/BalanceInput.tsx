import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  balanceDate: string | null
  onSave: (amount: number) => void
  onDateClick?: () => void
}

export default function BalanceInput({ value, balanceDate, onSave, onDateClick }: Props) {
  const [raw, setRaw] = useState(value.toFixed(2))
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRaw(value.toFixed(2))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const parsed = parseFloat(e.target.value.replace(/,/g, ''))
      if (!isNaN(parsed)) {
        setSaving(true)
        onSave(parsed)
        setTimeout(() => setSaving(false), 600)
      }
    }, 800)
  }

  const formatted = balanceDate
    ? new Date(balanceDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
        Today's Balance
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
          $
        </span>
        <input
          type="number"
          step="0.01"
          value={raw}
          onChange={handleChange}
          className="pl-7 pr-3 py-2 w-40 border border-gray-300 dark:border-gray-600 rounded-lg text-right font-mono text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      {saving && <span className="text-xs text-indigo-500 animate-pulse">Saving…</span>}
      {!saving && formatted && (
        <button
          onClick={onDateClick}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          as of {formatted}
        </button>
      )}
    </div>
  )
}
