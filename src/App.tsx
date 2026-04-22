import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdhocTransaction, AccountBalance, RecurringTransaction, SkippedOccurrence, TxEntry } from './types'
import * as api from './lib/api'
import { computeAllDailyBalances } from './lib/balance'
import BalanceInput from './components/BalanceInput'
import CalendarView from './components/CalendarView'
import TransactionModal from './components/TransactionModal'
import RecurringList from './components/RecurringList'

const today = new Date().toISOString().slice(0, 10)
const [todayYear, todayMonth] = today.split('-').map(Number)

function getRangeFromToday(): { fromDate: string; toDate: string } {
  const from = new Date()
  from.setMonth(from.getMonth() - 3, 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 18 + 1, 0)
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  }
}

export default function App() {
  const [balance, setBalance] = useState<AccountBalance>({ amount: 0, balance_date: today, updated_at: null })
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [adhoc, setAdhoc] = useState<AdhocTransaction[]>([])
  const [skipped, setSkipped] = useState<SkippedOccurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string | undefined>()
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | undefined>()
  const [recurringPanelOpen, setRecurringPanelOpen] = useState(false)

  // Initial data load
  useEffect(() => {
    Promise.all([api.getBalance(), api.getRecurring(), api.getAdhoc(), api.getSkipped()])
      .then(([bal, rec, adh, skp]) => {
        setBalance(bal)
        setRecurring(rec)
        setAdhoc(adh)
        setSkipped(skp)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const { fromDate, toDate } = useMemo(() => getRangeFromToday(), [])

  const dailyBalances = useMemo(() => {
    const anchorDate = balance.balance_date ?? today
    return computeAllDailyBalances(
      balance.amount,
      anchorDate,
      recurring,
      adhoc,
      skipped,
      fromDate,
      toDate
    )
  }, [balance, recurring, adhoc, skipped, fromDate, toDate])

  // Navigation
  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 1) { setViewYear((y) => y - 1); return 12 }
      return m - 1
    })
  }, [])

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) { setViewYear((y) => y + 1); return 1 }
      return m + 1
    })
  }, [])

  // Balance save
  const handleSaveBalance = useCallback(async (amount: number) => {
    const newBalance = { amount, balance_date: today, updated_at: new Date().toISOString() }
    setBalance(newBalance)
    await api.setBalance(amount, today)
  }, [])

  // Add transaction (modal open from day click)
  const handleDayClick = useCallback((date: string) => {
    setModalDate(date)
    setEditingRecurring(undefined)
    setModalOpen(true)
  }, [])

  // Add transaction (modal open from header button)
  const handleAddClick = useCallback(() => {
    setModalDate(undefined)
    setEditingRecurring(undefined)
    setModalOpen(true)
  }, [])

  // Toggle skip on a transaction occurrence
  const handleToggleSkip = useCallback(async (entry: TxEntry, date: string) => {
    if (entry.skipped) {
      await api.unskipOccurrence(entry.skippedId!)
      setSkipped((prev) => prev.filter((s) => s.id !== entry.skippedId))
    } else {
      const created = await api.skipOccurrence(entry.id, entry.source, date)
      setSkipped((prev) => [...prev, created])
    }
  }, [])

  // Save recurring
  const handleSaveRecurring = useCallback(
    async (data: Omit<RecurringTransaction, 'id' | 'active' | 'created_at'>) => {
      if (editingRecurring) {
        const updated = await api.updateRecurring(editingRecurring.id, data)
        setRecurring((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      } else {
        const created = await api.createRecurring(data)
        setRecurring((prev) => [...prev, created])
      }
    },
    [editingRecurring]
  )

  // Save ad-hoc
  const handleSaveAdhoc = useCallback(
    async (data: Omit<AdhocTransaction, 'id' | 'created_at'>) => {
      const created = await api.createAdhoc(data)
      setAdhoc((prev) => [...prev, created])
    },
    []
  )

  // Edit recurring (from RecurringList)
  const handleEditRecurring = useCallback((r: RecurringTransaction) => {
    setEditingRecurring(r)
    setModalDate(undefined)
    setModalOpen(true)
    setRecurringPanelOpen(false)
  }, [])

  // Delete recurring
  const handleDeleteRecurring = useCallback(async (id: string) => {
    if (!confirm('Remove this recurring transaction?')) return
    await api.deleteRecurring(id)
    setRecurring((prev) => prev.filter((r) => r.id !== id))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Failed to load</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-indigo-600">💰 Budget Buddy</span>
            <BalanceInput
              value={balance.amount}
              balanceDate={balance.balance_date}
              onSave={handleSaveBalance}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRecurringPanelOpen(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Recurring
            </button>
            <button
              onClick={handleAddClick}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      </header>

      {/* Calendar */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <CalendarView
          year={viewYear}
          month={viewMonth}
          balances={dailyBalances}
          onDayClick={handleDayClick}
          onToggleSkip={handleToggleSkip}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      </main>

      {/* Modals & panels */}
      <TransactionModal
        open={modalOpen}
        initialDate={modalDate}
        editRecurring={editingRecurring}
        onSaveRecurring={handleSaveRecurring}
        onSaveAdhoc={handleSaveAdhoc}
        onClose={() => setModalOpen(false)}
      />

      <RecurringList
        open={recurringPanelOpen}
        recurring={recurring}
        onEdit={handleEditRecurring}
        onDelete={handleDeleteRecurring}
        onClose={() => setRecurringPanelOpen(false)}
      />
    </div>
  )
}
