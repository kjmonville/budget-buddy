import SwiftUI

/// All recurring + one-time transactions, grouped by source and type.
/// Mirrors the web app's RecurringList "Schedule" panel.
struct ScheduleView: View {
    let api: APIClient
    let onEditRecurring: (RecurringTransaction) -> Void
    let onEditAdhoc: (AdhocTransaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    var body: some View {
        NavigationStack {
            List {
                section(title: "Recurring · Deposits", color: .bbDeposit) {
                    ForEach(recurring(.deposit)) { row($0) }
                }
                section(title: "Recurring · Expenses", color: .bbExpense) {
                    ForEach(recurring(.expense)) { row($0) }
                }
                section(title: "One-time · Deposits", color: .bbDeposit) {
                    ForEach(adhoc(.deposit)) { row($0) }
                }
                section(title: "One-time · Expenses", color: .bbExpense) {
                    ForEach(adhoc(.expense)) { row($0) }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private func section<Content: View>(title: String, color: Color, @ViewBuilder content: () -> Content) -> some View {
        Section {
            content()
        } header: {
            HStack(spacing: 6) {
                Circle().fill(color).frame(width: 8, height: 8)
                Text(title)
            }
        }
    }

    private func recurring(_ type: TransactionType) -> [RecurringTransaction] {
        store.recurring.filter { $0.type == type && $0.active != 0 }
    }

    private func adhoc(_ type: TransactionType) -> [AdhocTransaction] {
        store.adhoc.filter { $0.type == type }
    }

    private func row(_ r: RecurringTransaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(r.name).font(.body.weight(.medium))
                Text(scheduleDescription(r))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text((r.type == .expense ? -r.amount : r.amount).asCurrency)
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(r.type == .deposit ? Color.bbDeposit : Color.bbExpense)
        }
        .contentShape(Rectangle())
        .onTapGesture { onEditRecurring(r) }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task {
                    do {
                        try await api.deleteRecurring(id: r.id)
                        store.recurring.removeAll { $0.id == r.id }
                    } catch {
                        store.lastError = (error as? LocalizedError)?.errorDescription
                    }
                }
            } label: { Label("Delete", systemImage: "trash") }
            Button { onEditRecurring(r) } label: { Label("Edit", systemImage: "pencil") }
                .tint(.gray)
        }
    }

    private func row(_ a: AdhocTransaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(a.name).font(.body.weight(.medium))
                Text(formatDate(a.date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text((a.type == .expense ? -a.amount : a.amount).asCurrency)
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(a.type == .deposit ? Color.bbDeposit : Color.bbExpense)
        }
        .contentShape(Rectangle())
        .onTapGesture { onEditAdhoc(a) }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task {
                    do {
                        try await api.deleteAdhoc(id: a.id)
                        store.adhoc.removeAll { $0.id == a.id }
                    } catch {
                        store.lastError = (error as? LocalizedError)?.errorDescription
                    }
                }
            } label: { Label("Delete", systemImage: "trash") }
            Button { onEditAdhoc(a) } label: { Label("Edit", systemImage: "pencil") }
                .tint(.gray)
        }
    }

    private func scheduleDescription(_ r: RecurringTransaction) -> String {
        switch r.recurrence_type {
        case .monthly_fixed:
            return "Monthly on day \(r.day_of_month ?? 1)"
        case .weekly:
            return "Weekly on \(weekdayName(r.day_of_week ?? 0))"
        case .biweekly:
            return "Every two weeks on \(weekdayName(r.day_of_week ?? 0))"
        case .yearly:
            let m = monthName(r.month ?? 1)
            return "Yearly on \(m) \(r.day_of_month ?? 1)"
        case .monthly_nth_weekday:
            let nth: String = {
                switch r.nth_week ?? 1 {
                case 1: return "first"; case 2: return "second"; case 3: return "third"
                case 4: return "fourth"; case 5: return "fifth"; case -1: return "last"
                default: return "nth"
                }
            }()
            return "Monthly on the \(nth) \(weekdayName(r.day_of_week ?? 0))"
        }
    }

    private func formatDate(_ ymd: String) -> String {
        guard let d = Calendar.parseYMD(ymd) else { return ymd }
        return d.formatted(.dateTime.month(.abbreviated).day().year())
    }
    private func monthName(_ i: Int) -> String {
        ["January","February","March","April","May","June",
         "July","August","September","October","November","December"][max(0, min(11, i - 1))]
    }
    private func weekdayName(_ i: Int) -> String {
        ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][max(0, min(6, i))]
    }
}
