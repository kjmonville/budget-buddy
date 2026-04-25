import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdhocTransaction, AccountBalance, RecurringTransaction, SkippedOccurrence, TxEntry, User } from './types'
import * as api from './lib/api'
import { computeAllDailyBalances, localDateStr } from './lib/balance'
import { applyTheme, getStoredTheme, type Theme } from './lib/theme'
import BalanceInput from './components/BalanceInput'
import CalendarView from './components/CalendarView'
import TransactionModal from './components/TransactionModal'
import RecurringList from './components/RecurringList'
import LoginPage from './components/LoginPage'

const today = localDateStr()
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
  // undefined = checking auth, null = not authed, User = authed
  const [user, setUser] = useState<User | null | undefined>(undefined)

  const [balance, setBalance] = useState<AccountBalance>({ amount: 0, balance_date: today, updated_at: null, cutoff_date: null })
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [adhoc, setAdhoc] = useState<AdhocTransaction[]>([])
  const [skipped, setSkipped] = useState<SkippedOccurrence[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string | undefined>()
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | undefined>()
  const [editingAdhoc, setEditingAdhoc] = useState<AdhocTransaction | undefined>()
  const [recurringPanelOpen, setRecurringPanelOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  // Apply theme on mount and listen for system preference changes
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('auto')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Check auth on mount
  useEffect(() => {
    api.getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  // Load data once authenticated
  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError('')
    Promise.all([api.getBalance(), api.getRecurring(), api.getAdhoc(), api.getSkipped()])
      .then(([bal, rec, adh, skp]) => {
        setBalance(bal)
        setRecurring(rec)
        setAdhoc(adh)
        setSkipped(skp)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [user])

  const { fromDate, toDate } = useMemo(() => getRangeFromToday(), [])

  const dailyBalances = useMemo(() => {
    const anchorDate = balance.balance_date ?? today
    const cutoffDate = balance.cutoff_date ?? today.slice(0, 7) + '-01'
    return computeAllDailyBalances(
      balance.amount,
      anchorDate,
      recurring,
      adhoc,
      skipped,
      cutoffDate,
      fromDate,
      toDate
    )
  }, [balance, recurring, adhoc, skipped, fromDate, toDate])

  const lowestBalance = useMemo(() => {
    let min: number | null = null
    let minDate: string | null = null
    for (const [date, day] of Object.entries(dailyBalances)) {
      if (day.endBalance === null) continue
      if (min === null || day.endBalance < min) {
        min = day.endBalance
        minDate = date
      }
    }
    return min !== null ? { amount: min, date: minDate! } : null
  }, [dailyBalances])

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

  // Theme change
  const handleThemeChange = useCallback((t: Theme) => {
    setTheme(t)
    applyTheme(t)
  }, [])

  // Logout
  const handleLogout = useCallback(async () => {
    await api.logout()
    setUser(null)
    setBalance({ amount: 0, balance_date: today, updated_at: null, cutoff_date: null })
    setRecurring([])
    setAdhoc([])
    setSkipped([])
  }, [])

  // Balance save
  const handleSaveBalance = useCallback(async (amount: number) => {
    const newBalance = { ...balance, amount, balance_date: today, updated_at: new Date().toISOString() }
    setBalance(newBalance)
    await api.setBalance(amount, today)
  }, [balance])

  // Add transaction (modal open from day click)
  const handleDayClick = useCallback((date: string) => {
    setModalDate(date)
    setEditingRecurring(undefined)
    setEditingAdhoc(undefined)
    setModalOpen(true)
  }, [])

  // Add transaction (modal open from header button)
  const handleAddClick = useCallback(() => {
    setModalDate(undefined)
    setEditingRecurring(undefined)
    setEditingAdhoc(undefined)
    setModalOpen(true)
  }, [])

  // Close modal and clear editing state
  const handleModalClose = useCallback(() => {
    setModalOpen(false)
    setEditingRecurring(undefined)
    setEditingAdhoc(undefined)
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

  // Update ad-hoc (from Schedule panel edit)
  const handleUpdateAdhoc = useCallback(
    async (data: Omit<AdhocTransaction, 'id' | 'created_at'>) => {
      const updated = await api.updateAdhoc(editingAdhoc!.id, data)
      setAdhoc((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    },
    [editingAdhoc]
  )

  // Edit recurring (from Schedule panel)
  const handleEditRecurring = useCallback((r: RecurringTransaction) => {
    setEditingRecurring(r)
    setEditingAdhoc(undefined)
    setModalDate(undefined)
    setModalOpen(true)
    setRecurringPanelOpen(false)
  }, [])

  // Edit ad-hoc (from Schedule panel)
  const handleEditAdhoc = useCallback((t: AdhocTransaction) => {
    setEditingAdhoc(t)
    setEditingRecurring(undefined)
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

  // Delete ad-hoc
  const handleDeleteAdhoc = useCallback(async (id: string) => {
    if (!confirm('Remove this transaction?')) return
    await api.deleteAdhoc(id)
    setAdhoc((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Edit entry from calendar context menu
  const handleCalendarEdit = useCallback((entry: TxEntry) => {
    if (entry.source === 'recurring') {
      const r = recurring.find((r) => r.id === entry.id)
      if (!r) return
      setEditingRecurring(r)
      setEditingAdhoc(undefined)
      setModalDate(undefined)
      setModalOpen(true)
    } else {
      const t = adhoc.find((t) => t.id === entry.id)
      if (!t) return
      setEditingAdhoc(t)
      setEditingRecurring(undefined)
      setModalDate(undefined)
      setModalOpen(true)
    }
  }, [recurring, adhoc])

  // Delete entry from calendar context menu
  const handleCalendarDelete = useCallback((entry: TxEntry) => {
    if (entry.source === 'recurring') {
      handleDeleteRecurring(entry.id)
    } else {
      handleDeleteAdhoc(entry.id)
    }
  }, [handleDeleteRecurring, handleDeleteAdhoc])

  // Checking auth
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500">
        Loading…
      </div>
    )
  }

  // Not authenticated
  if (user === null) {
    return <LoginPage onSuccess={setUser} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Failed to load</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          {/* Row 1: logo + theme + user */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/60">
            <span className="text-xl font-bold text-indigo-600">💰 Budget Buddy</span>
            <div className="flex items-center gap-3">
              <ThemeToggle value={theme} onChange={handleThemeChange} />
              <span className="text-xs text-gray-400 dark:text-gray-500">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
          {/* Row 2: balance + actions */}
          <div className="flex items-center justify-between py-2.5">
            <BalanceInput
              value={balance.amount}
              balanceDate={balance.balance_date}
              onSave={handleSaveBalance}
              onDateClick={() => {
                const d = new Date((balance.balance_date ?? today) + 'T00:00:00')
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth() + 1)
              }}
            />
            {lowestBalance && (
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Balance</span>
                <span className={`text-sm font-mono font-semibold tabular-nums ${lowestBalance.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                  {lowestBalance.amount < 0 ? '-' : ''}${Math.abs(lowestBalance.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  onClick={() => {
                    const d = new Date(lowestBalance.date + 'T00:00:00')
                    setViewYear(d.getFullYear())
                    setViewMonth(d.getMonth() + 1)
                  }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                >
                  on {new Date(lowestBalance.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRecurringPanelOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={handleAddClick}
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Add
              </button>
            </div>
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
          onEdit={handleCalendarEdit}
          onDelete={handleCalendarDelete}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      </main>

      {/* Modals & panels */}
      <TransactionModal
        open={modalOpen}
        initialDate={modalDate}
        editRecurring={editingRecurring}
        editAdhoc={editingAdhoc}
        onSaveRecurring={handleSaveRecurring}
        onSaveAdhoc={handleSaveAdhoc}
        onUpdateAdhoc={handleUpdateAdhoc}
        onClose={handleModalClose}
      />

      <RecurringList
        open={recurringPanelOpen}
        recurring={recurring}
        adhoc={adhoc}
        onEdit={handleEditRecurring}
        onDelete={handleDeleteRecurring}
        onEditAdhoc={handleEditAdhoc}
        onDeleteAdhoc={handleDeleteAdhoc}
        onClose={() => setRecurringPanelOpen(false)}
      />
    </div>
  )
}

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'auto', label: 'Auto', icon: '⊙' },
  { value: 'dark', label: 'Dark', icon: '☾' },
]

function ThemeToggle({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.label}
          className={[
            'px-2 py-1.5 text-sm transition-colors',
            value === opt.value
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
          ].join(' ')}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}
