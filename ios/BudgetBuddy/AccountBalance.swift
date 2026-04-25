import Foundation

struct AccountBalance: Codable, Hashable {
    var amount: Double
    var balance_date: String?    // YYYY-MM-DD
    var updated_at: String?
    var cutoff_date: String?     // YYYY-MM-01

    static let empty = AccountBalance(amount: 0, balance_date: nil, updated_at: nil, cutoff_date: nil)
}
