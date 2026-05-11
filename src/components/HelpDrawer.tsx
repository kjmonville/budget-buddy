import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

interface SectionProps {
  title: string
  children: ReactNode
  screenshotFile: string
  screenshotInstructions: string
}

function HelpSection({ title, children, screenshotFile, screenshotInstructions }: SectionProps) {
  return (
    <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">
        {title}
      </h2>
      <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-2">
        {children}
      </div>
      <div
        className="mt-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 flex flex-col items-center justify-center gap-1.5 p-4 min-h-[120px]"
        aria-label={screenshotInstructions}
      >
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{screenshotFile}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">{screenshotInstructions}</span>
      </div>
    </div>
  )
}

export default function HelpDrawer({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 h-full w-full max-w-sm shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Help</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
            aria-label="Close help"
          >
            &times;
          </button>
        </div>

        <HelpSection
          title="Setting Your Balance"
          screenshotFile="public/help/help-balance-field.png"
          screenshotInstructions={`Show the app header with the "Today's Balance" input field. Arrow pointing to field. Callout: "Enter your real bank balance here."`}
        >
          <p>
            The <strong className="text-gray-800 dark:text-gray-100">Today&apos;s Balance</strong> field is the foundation of everything Budget Buddy does. Enter the actual current balance from your bank account here.
          </p>
          <p>
            Every projected balance you see going forward is calculated from this number, so keeping it up to date gives you the most accurate picture of your finances.
          </p>
        </HelpSection>

        <HelpSection
          title="Projected Daily Balance"
          screenshotFile="public/help/help-projected-balance.png"
          screenshotInstructions={`Show the calendar with day cells each displaying an end-of-day balance number. Highlight one cell. Arrow on the balance number. Callout: "Projected end-of-day balance."`}
        >
          <p>
            Each day on the calendar shows a <strong className="text-gray-800 dark:text-gray-100">projected end-of-day balance</strong> — what your account should look like after all of that day&apos;s transactions have cleared.
          </p>
          <p>
            Budget Buddy works forward from today only. Past days don&apos;t show a projected balance — only today and future dates do.
          </p>
        </HelpSection>

        <HelpSection
          title="Reading the Calendar"
          screenshotFile="public/help/help-calendar-nav.png"
          screenshotInstructions={`Show the calendar month header with ‹ and › navigation arrows. Arrows pointing to both chevrons, callout on the month/year label.`}
        >
          <p>
            Use the <strong className="text-gray-800 dark:text-gray-100">‹</strong> and <strong className="text-gray-800 dark:text-gray-100">›</strong> arrows to move between months. Each day cell shows any transactions scheduled for that day, along with the projected balance after they&apos;re applied.
          </p>
          <p>
            Tap any transaction badge in a day cell to mark it as cleared (more on that below).
          </p>
        </HelpSection>

        <HelpSection
          title="Recurring Transactions"
          screenshotFile="public/help/help-recurring.png"
          screenshotInstructions={`Show the Add/Edit Transaction modal with the recurrence type picker visible. Highlight the picker. Callout: "Choose how often it repeats."`}
        >
          <p>
            Recurring transactions repeat automatically on a schedule you define. When you add one, pick from these patterns:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1 text-gray-600 dark:text-gray-300">
            <li><strong className="text-gray-700 dark:text-gray-200">Weekly</strong> — every occurrence of a specific weekday</li>
            <li><strong className="text-gray-700 dark:text-gray-200">Biweekly</strong> — every other week on a specific weekday, anchored to a start date</li>
            <li><strong className="text-gray-700 dark:text-gray-200">Monthly (fixed day)</strong> — same date every month (e.g. the 15th)</li>
            <li><strong className="text-gray-700 dark:text-gray-200">Monthly (nth weekday)</strong> — e.g. the last Friday of each month</li>
            <li><strong className="text-gray-700 dark:text-gray-200">Yearly</strong> — once a year on a specific date</li>
          </ul>
          <p className="mt-1">
            Recurring transactions show up on every matching date automatically — no need to add them again each month.
          </p>
        </HelpSection>

        <HelpSection
          title="One-Time Transactions"
          screenshotFile="public/help/help-adhoc.png"
          screenshotInstructions={`Show the Add Transaction modal with a one-time transaction and a specific date selected. Highlight the date field. Callout: "Pick the exact date it happens."`}
        >
          <p>
            One-time transactions (also called <strong className="text-gray-800 dark:text-gray-100">adhoc</strong> transactions) are for things that happen on a specific date and don&apos;t repeat. A car registration renewal, a birthday dinner, or a one-off freelance payment are all good examples.
          </p>
          <p>
            They appear on the calendar only on the date you choose.
          </p>
        </HelpSection>

        <HelpSection
          title="Cleared"
          screenshotFile="public/help/help-cleared.png"
          screenshotInstructions={`Show a calendar day with two badges — one normal and one struck-through (cleared). Arrow to the struck-through one. Callout: "Tap to clear — tap again to restore."`}
        >
          <p>
            Tapping a transaction badge marks it as <strong className="text-gray-800 dark:text-gray-100">cleared</strong> — meaning it has already come out of (or landed in) your real bank account. The transaction appears struck-through and is excluded from the balance projection, since your starting balance already reflects it.
          </p>
          <p>
            Tap a cleared transaction again to restore it to the projection.
          </p>
        </HelpSection>

        <HelpSection
          title="Paid Flag"
          screenshotFile="public/help/help-paid.png"
          screenshotInstructions={`Show a transaction badge with the paid indicator visible. Arrow pointing to the paid marker. Callout: "Paid."`}
        >
          <p>
            The <strong className="text-gray-800 dark:text-gray-100">paid</strong> flag is a personal reminder that you&apos;ve made a payment, but it hasn&apos;t cleared your bank account yet.
          </p>
          <p>
            Marking something as paid doesn&apos;t affect the balance projection — the transaction still counts since your bank hasn&apos;t processed it. It&apos;s purely a visual note for your own tracking.
          </p>
        </HelpSection>
      </div>
    </div>
  )
}
