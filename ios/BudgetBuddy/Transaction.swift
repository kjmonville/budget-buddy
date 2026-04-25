import Foundation

enum TransactionType: String, Codable, CaseIterable, Hashable {
    case deposit
    case expense
}

enum RecurrenceType: String, Codable, CaseIterable, Hashable {
    case monthly_fixed
    case weekly
    case biweekly
    case yearly
    case monthly_nth_weekday

    var label: String {
        switch self {
        case .monthly_fixed:        return "Monthly — fixed day"
        case .weekly:               return "Weekly"
        case .biweekly:             return "Every two weeks"
        case .yearly:               return "Yearly"
        case .monthly_nth_weekday:  return "Monthly — nth weekday"
        }
    }
}

struct RecurringTransaction: Codable, Identifiable, Hashable {
    let id: String
    var type: TransactionType
    var name: String
    var amount: Double
    var recurrence_type: RecurrenceType
    var day_of_month: Int?
    var month: Int?
    var day_of_week: Int?
    var nth_week: Int?
    var biweekly_anchor: String?
    var notes: String?
    var active: Int
    var created_at: String
}

struct AdhocTransaction: Codable, Identifiable, Hashable {
    let id: String
    var type: TransactionType
    var name: String
    var amount: Double
    var date: String       // YYYY-MM-DD
    var notes: String?
    var created_at: String
}

/// Body sent to POST /api/recurring (server fills id, active, created_at, user_id).
struct NewRecurring: Codable {
    var type: TransactionType
    var name: String
    var amount: Double
    var recurrence_type: RecurrenceType
    var day_of_month: Int?
    var month: Int?
    var day_of_week: Int?
    var nth_week: Int?
    var biweekly_anchor: String?
    var notes: String?
}

/// Body sent to POST /api/adhoc (server fills id, created_at, user_id).
struct NewAdhoc: Codable {
    var type: TransactionType
    var name: String
    var amount: Double
    var date: String
    var notes: String?
}
