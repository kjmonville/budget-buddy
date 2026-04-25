import Foundation

struct SkippedOccurrence: Codable, Identifiable, Hashable {
    let id: String
    let transaction_id: String
    let transaction_type: String   // "recurring" | "adhoc"
    let date: String               // YYYY-MM-DD
    let created_at: String
}
