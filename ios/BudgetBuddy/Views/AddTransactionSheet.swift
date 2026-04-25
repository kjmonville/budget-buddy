import SwiftUI

struct AddTransactionSheet: View {
    let api: APIClient
    let initialDate: String?

    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    @State private var mode: TransactionForm.Mode = .recurring
    @State private var error = ""
    @State private var saving = false

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

    // One-time
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
                    aDate: $aDate, aNotes: $aNotes
                )
            }
            .navigationTitle("Add Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if saving { ProgressView() } else { Text("Add").bold() }
                    }
                    .disabled(saving)
                }
            }
            .onAppear { setDefaultsFromInitialDate() }
        }
    }

    private func setDefaultsFromInitialDate() {
        guard let s = initialDate, let d = Calendar.parseYMD(s) else { return }
        aDate = d
        rDayOfMonth = Calendar.gregorian.component(.day, from: d)
    }

    private func save() {
        error = ""
        saving = true
        Task {
            do {
                if mode == .recurring {
                    let body = try TransactionFormValidator.buildRecurring(
                        type: rType, name: rName, amount: rAmount,
                        recType: rRecType, dayOfMonth: rDayOfMonth, month: rMonth,
                        dayOfWeek: rDayOfWeek, nthWeek: rNthWeek,
                        anchor: rAnchor, anchorSet: rAnchorSet, notes: rNotes
                    )
                    let created = try await api.createRecurring(body)
                    store.recurring.append(created)
                } else {
                    let body = try TransactionFormValidator.buildAdhoc(
                        type: aType, name: aName, amount: aAmount, date: aDate, notes: aNotes
                    )
                    let created = try await api.createAdhoc(body)
                    store.adhoc.append(created)
                }
                dismiss()
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            saving = false
        }
    }
}
