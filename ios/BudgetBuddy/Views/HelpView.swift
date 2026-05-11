import SwiftUI

struct HelpView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                HelpSection(
                    title: "Setting Your Balance",
                    body: "The Today's Balance field is the foundation of everything Budget Buddy does. Enter the actual current balance from your bank account here.\n\nEvery projected balance going forward is calculated from this number, so keeping it up to date gives you the most accurate picture of your finances.",
                    screenshotName: "help-balance-field",
                    screenshotInstructions: "Screenshot needed: Show the balance input field at the top of the main screen. Add an arrow pointing to it with the callout: \"Enter your real bank balance here.\""
                )

                HelpSection(
                    title: "Projected Daily Balance",
                    body: "Each day on the calendar shows a projected end-of-day balance — what your account should look like after all of that day's transactions have cleared.\n\nBudget Buddy works forward from today only. Past days don't show a projected balance — only today and future dates do.",
                    screenshotName: "help-projected-balance",
                    screenshotInstructions: "Screenshot needed: Show the calendar with several day cells visible, each displaying a balance number. Highlight one cell with a callout arrow on the bottom number: \"Projected end-of-day balance.\""
                )

                HelpSection(
                    title: "Reading the Calendar",
                    body: "Swipe left or right to move between months. Each day cell shows any transactions scheduled for that day, along with the projected balance after they're applied.\n\nTap any transaction badge in a day cell to mark it as cleared (more on that below).",
                    screenshotName: "help-calendar-nav",
                    screenshotInstructions: "Screenshot needed: Show the calendar with the month header and navigation controls visible. Add callouts pointing to the navigation controls and the month/year label."
                )

                HelpSection(
                    title: "Recurring Transactions",
                    body: "Recurring transactions repeat automatically on a schedule you define. When you add one, pick from these patterns:\n\n• Weekly — every occurrence of a specific weekday\n• Biweekly — every other week, anchored to a start date\n• Monthly (fixed day) — same date every month\n• Monthly (nth weekday) — e.g. the last Friday of each month\n• Yearly — once a year on a specific date\n\nRecurring transactions show up on every matching date automatically.",
                    screenshotName: "help-recurring",
                    screenshotInstructions: "Screenshot needed: Show the Add/Edit Transaction form with the recurrence type picker visible. Highlight the picker with a callout: \"Choose how often it repeats.\""
                )

                HelpSection(
                    title: "One-Time Transactions",
                    body: "One-time transactions (also called adhoc transactions) are for things that happen on a specific date and don't repeat. A car registration renewal, a birthday dinner, or a one-off freelance payment are all good examples.\n\nThey appear on the calendar only on the date you choose.",
                    screenshotName: "help-adhoc",
                    screenshotInstructions: "Screenshot needed: Show the Add Transaction form with a one-time transaction and a specific date selected. Highlight the date field with a callout: \"Pick the exact date it happens.\""
                )

                HelpSection(
                    title: "Cleared",
                    body: "Tapping a transaction badge marks it as cleared — meaning it has already come out of (or landed in) your real bank account. The transaction appears struck-through and is excluded from the balance projection, since your starting balance already reflects it.\n\nTap a cleared transaction again to restore it to the projection.",
                    screenshotName: "help-cleared",
                    screenshotInstructions: "Screenshot needed: Show a calendar day with two transaction badges — one normal and one struck-through (cleared). Add an arrow to the struck-through one with a callout: \"Tap to clear — tap again to restore.\""
                )

                HelpSection(
                    title: "Paid Flag",
                    body: "The paid flag is a personal reminder that you've made a payment, but it hasn't cleared your bank account yet.\n\nMarking something as paid doesn't affect the balance projection — the transaction still counts since your bank hasn't processed it. It's purely a visual note for your own tracking.",
                    screenshotName: "help-paid",
                    screenshotInstructions: "Screenshot needed: Show a transaction badge displaying the paid indicator. Add a callout arrow pointing to the paid marker with the label \"Paid.\""
                )
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Help")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct HelpSection: View {
    let title: String
    let body: String
    let screenshotName: String
    let screenshotInstructions: String

    var body: some View {
        Section(header: Text(title).foregroundStyle(Color.bbIndigo)) {
            Text(body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.vertical, 4)

            ScreenshotPlaceholder(filename: screenshotName, instructions: screenshotInstructions)
        }
    }
}

private struct ScreenshotPlaceholder: View {
    let filename: String
    let instructions: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(filename + ".png")
                .font(.caption.monospaced())
                .foregroundStyle(.tertiary)

            Text(instructions)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(.systemGroupedBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        .foregroundStyle(Color(.systemFill))
                )
        )
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
    }
}
