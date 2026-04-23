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
  const savedRef = useRef(false)

  useEffect(() => {
    setRaw(value.toFixed(2))
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseFloat((e.target as HTMLInputElement).value.replace(/,/g, ''))
      if (!isNaN(parsed)) {
        savedRef.current = true
        setSaving(true)
        onSave(parsed)
        setTimeout(() => setSaving(false), 600)
        ;(e.target as HTMLInputElement).blur()
      }
    }
  }

  const handleBlur = () => {
    if (!savedRef.current) {
      setRaw(value.toFixed(2))
    }
    savedRef.current = false
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
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onFocus={e => e.target.select()}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
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
