import SwiftUI

/// Shared form body used by Add and Edit sheets. Mirrors the field layout
/// and validation in src/components/TransactionModal.tsx.
struct TransactionForm: View {
    enum Mode: Hashable { case recurring, oneTime }

    @Binding var mode: Mode

    // Recurring fields
    @Binding var rType: TransactionType
    @Binding var rName: String
    @Binding var rAmount: String
    @Binding var rRecType: RecurrenceType
    @Binding var rDayOfMonth: Int
    @Binding var rMonth: Int
    @Binding var rDayOfWeek: Int
    @Binding var rNthWeek: Int
    @Binding var rAnchor: Date
    @Binding var rAnchorSet: Bool
    @Binding var rNotes: String

    // One-time fields
    @Binding var aType: TransactionType
    @Binding var aName: String
    @Binding var aAmount: String
    @Binding var aDate: Date
    @Binding var aNotes: String

    /// If false, the Recurring/One-Time picker is hidden (edit screens lock the mode).
    var allowModeSwitch: Bool = true

    var body: some View {
        Form {
            if allowModeSwitch {
                Section {
                    Picker("", selection: $mode) {
                        Text("Recurring").tag(Mode.recurring)
                        Text("One-time").tag(Mode.oneTime)
                    }
                    .pickerStyle(.segmented)
                }
            }

            if mode == .recurring {
                recurringFields
            } else {
                oneTimeFields
            }
        }
    }

    @ViewBuilder
    private var recurringFields: some View {
        Section {
            typePicker(selection: $rType)
            TextField("Name (e.g. Rent, Paycheck)", text: $rName)
            HStack {
                Text("$")
                TextField("0.00", text: $rAmount)
                    .keyboardType(.decimalPad)
            }
            Picker("Repeats", selection: $rRecType) {
                ForEach(RecurrenceType.allCases, id: \.self) { t in
                    Text(t.label).tag(t)
                }
            }
        }

        Section {
            switch rRecType {
            case .monthly_fixed:
                Stepper("Day of month: \(rDayOfMonth)", value: $rDayOfMonth, in: 1...31)
            case .yearly:
                Picker("Month", selection: $rMonth) {
                    ForEach(1...12, id: \.self) { i in
                        Text(monthName(i)).tag(i)
                    }
                }
                Stepper("Day: \(rDayOfMonth)", value: $rDayOfMonth, in: 1...31)
            case .weekly:
                Picker("Day of week", selection: $rDayOfWeek) {
                    ForEach(0...6, id: \.self) { i in
                        Text(weekdayName(i)).tag(i)
                    }
                }
            case .biweekly:
                Picker("Day of week", selection: $rDayOfWeek) {
                    ForEach(0...6, id: \.self) { i in
                        Text(weekdayName(i)).tag(i)
                    }
                }
                DatePicker("Starting date",
                           selection: Binding(get: { rAnchor }, set: { rAnchor = $0; rAnchorSet = true }),
                           displayedComponents: .date)
                Text("Pick any past occurrence of this transaction")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            case .monthly_nth_weekday:
                Picker("Which occurrence", selection: $rNthWeek) {
                    Text("First").tag(1)
                    Text("Second").tag(2)
                    Text("Third").tag(3)
                    Text("Fourth").tag(4)
                    Text("Fifth").tag(5)
                    Text("Last").tag(-1)
                }
                Picker("Day of week", selection: $rDayOfWeek) {
                    ForEach(0...6, id: \.self) { i in
                        Text(weekdayName(i)).tag(i)
                    }
                }
            }
        }

        Section("Notes") {
            TextField("Optional", text: $rNotes, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    @ViewBuilder
    private var oneTimeFields: some View {
        Section {
            typePicker(selection: $aType)
            TextField("Name (e.g. Grocery run)", text: $aName)
            HStack {
                Text("$")
                TextField("0.00", text: $aAmount)
                    .keyboardType(.decimalPad)
            }
            DatePicker("Date", selection: $aDate, displayedComponents: .date)
        }
        Section("Notes") {
            TextField("Optional", text: $aNotes, axis: .vertical)
                .lineLimit(2...4)
        }
    }

    private func typePicker(selection: Binding<TransactionType>) -> some View {
        Picker("Type", selection: selection) {
            Text("Expense").tag(TransactionType.expense)
            Text("Deposit").tag(TransactionType.deposit)
        }
        .pickerStyle(.segmented)
    }

    private func monthName(_ i: Int) -> String {
        let names = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"]
        return names[max(0, min(11, i - 1))]
    }
    private func weekdayName(_ i: Int) -> String {
        ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][max(0, min(6, i))]
    }
}

/// Validates the form and returns either a `NewRecurring` or `NewAdhoc` body
/// ready for the API. Throws a user-friendly error on invalid input.
enum TransactionFormValidator {
    enum ValidationError: LocalizedError {
        case emptyName, badAmount, missingDate
        var errorDescription: String? {
            switch self {
            case .emptyName:    return "Name is required"
            case .badAmount:    return "Amount must be a positive number"
            case .missingDate:  return "Date is required"
            }
        }
    }

    static func buildRecurring(
        type: TransactionType, name: String, amount: String,
        recType: RecurrenceType, dayOfMonth: Int, month: Int,
        dayOfWeek: Int, nthWeek: Int, anchor: Date, anchorSet: Bool, notes: String
    ) throws -> NewRecurring {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { throw ValidationError.emptyName }
        guard let amt = Double(amount), amt > 0 else { throw ValidationError.badAmount }

        let dom: Int? = [.monthly_fixed, .yearly].contains(recType) ? dayOfMonth : nil
        let m: Int? = recType == .yearly ? month : nil
        let dow: Int? = [.weekly, .biweekly, .monthly_nth_weekday].contains(recType) ? dayOfWeek : nil
        let nth: Int? = recType == .monthly_nth_weekday ? nthWeek : nil
        let anc: String? = (recType == .biweekly && anchorSet) ? Calendar.ymdString(anchor) : nil
        let trimmedNotes = notes.trimmingCharacters(in: .whitespaces)

        return NewRecurring(
            type: type, name: trimmed, amount: amt,
            recurrence_type: recType,
            day_of_month: dom, month: m, day_of_week: dow, nth_week: nth,
            biweekly_anchor: anc,
            notes: trimmedNotes.isEmpty ? nil : trimmedNotes
        )
    }

    static func buildAdhoc(
        type: TransactionType, name: String, amount: String, date: Date, notes: String
    ) throws -> NewAdhoc {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { throw ValidationError.emptyName }
        guard let amt = Double(amount), amt > 0 else { throw ValidationError.badAmount }
        let trimmedNotes = notes.trimmingCharacters(in: .whitespaces)
        return NewAdhoc(
            type: type, name: trimmed, amount: amt,
            date: Calendar.ymdString(date),
            notes: trimmedNotes.isEmpty ? nil : trimmedNotes
        )
    }
}
