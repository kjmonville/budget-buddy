import SwiftUI

struct EditTransactionSheet: View {
    enum Editing: Hashable {
        case recurring(RecurringTransaction)
        case adhoc(AdhocTransaction)
    }

    let api: APIClient
    let editing: Editing

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    @State private var mode: TransactionForm.Mode = .recurring
    @State private var error = ""
    @State private var saving = false
    @State private var confirmingDelete = false

    // Recurring
    @State private var rType: TransactionType = .expense
    @State private var rName = ""
    @State private var rAmount = ""
    @State private var rRecType: RecurrenceType = .monthly_fixed
    @State private var rDayOfMonth: Int = 1
    @State private var rMonth: Int = 1
    @State private var rDayOfWeek: Int = 5
    @State private var rNthWeek: Int = 1
    @State private var rAnchor: Date = Date()
    @State private var rAnchorSet = false
    @State private var rNotes = ""

    // Adhoc
    @State private var aType: TransactionType = .expense
    @State private var aName = ""
    @State private var aAmount = ""
    @State private var aDate: Date = Date()
    @State private var aNotes = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !error.isEmpty {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal)
                        .padding(.top, 8)
                }
                TransactionForm(
                    mode: $mode,
                    rType: $rType, rName: $rName, rAmount: $rAmount,
                    rRecType: $rRecType, rDayOfMonth: $rDayOfMonth, rMonth: $rMonth,
                    rDayOfWeek: $rDayOfWeek, rNthWeek: $rNthWeek,
                    rAnchor: $rAnchor, rAnchorSet: $rAnchorSet, rNotes: $rNotes,
                    aType: $aType, aName: $aName, aAmount: $aAmount,
                    aDate: $aDate, aNotes: $aNotes,
                    allowModeSwitch: false
                )

                Button(role: .destructive) {
                    confirmingDelete = true
                } label: {
                    Label("Delete transaction", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if saving { ProgressView() } else { Text("Save").bold() }
                    }
                    .disabled(saving)
                }
            }
            .onAppear(perform: prefill)
            .confirmationDialog("Delete this transaction?",
                                isPresented: $confirmingDelete,
                                titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await performDelete() } }
                Button("Cancel", role: .cancel) {}
            } message: {
                if case .recurring = editing {
                    Text("This deletes the entire recurring series. To skip just one occurrence, swipe the row in the calendar instead.")
                } else {
                    Text("This action cannot be undone.")
                }
            }
        }
    }

    private var title: String {
        switch editing {
        case .recurring: return "Edit Recurring"
        case .adhoc:     return "Edit Transaction"
        }
    }

    private func prefill() {
        switch editing {
        case .recurring(let r):
            mode = .recurring
            rType = r.type
            rName = r.name
            rAmount = String(format: "%g", r.amount)
            rRecType = r.recurrence_type
            rDayOfMonth = r.day_of_month ?? 1
            rMonth = r.month ?? 1
            rDayOfWeek = r.day_of_week ?? 5
            rNthWeek = r.nth_week ?? 1
            if let a = r.biweekly_anchor, let d = Calendar.parseYMD(a) {
                rAnchor = d; rAnchorSet = true
            }
            rNotes = r.notes ?? ""
        case .adhoc(let a):
            mode = .oneTime
            aType = a.type
            aName = a.name
            aAmount = String(format: "%g", a.amount)
            if let d = Calendar.parseYMD(a.date) { aDate = d }
            aNotes = a.notes ?? ""
        }
    }

    private func save() {
        error = ""
        saving = true
        Task {
            do {
                switch editing {
                case .recurring(let r):
                    let body = try TransactionFormValidator.buildRecurring(
                        type: rType, name: rName, amount: rAmount,
                        recType: rRecType, dayOfMonth: rDayOfMonth, month: rMonth,
                        dayOfWeek: rDayOfWeek, nthWeek: rNthWeek,
                        anchor: rAnchor, anchorSet: rAnchorSet, notes: rNotes
                    )
                    let updated = try await api.updateRecurring(id: r.id, body)
                    if let i = store.recurring.firstIndex(where: { $0.id == r.id }) {
                        store.recurring[i] = updated
                    }
                case .adhoc(let a):
                    let body = try TransactionFormValidator.buildAdhoc(
                        type: aType, name: aName, amount: aAmount, date: aDate, notes: aNotes
                    )
                    let updated = try await api.updateAdhoc(id: a.id, body)
                    if let i = store.adhoc.firstIndex(where: { $0.id == a.id }) {
                        store.adhoc[i] = updated
                    }
                }
                dismiss()
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            saving = false
        }
    }

    private func performDelete() async {
        do {
            switch editing {
            case .recurring(let r):
                try await api.deleteRecurring(id: r.id)
                store.recurring.removeAll { $0.id == r.id }
            case .adhoc(let a):
                try await api.deleteAdhoc(id: a.id)
                store.adhoc.removeAll { $0.id == a.id }
            }
            dismiss()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
