import Foundation

struct TxEntry: Identifiable, Hashable {
    enum Source: String, Hashable { case recurring, adhoc }
    let id: String              // composite: "<txId>|<date>" so SwiftUI lists are stable across days
    let txId: String
    let name: String
    let amount: Double          // always positive — sign comes from `type`
    let type: TransactionType
    let source: Source
    var skipped: Bool
    var skippedId: String?

    /// Negative for expenses, positive for deposits.
    var signedAmount: Double { type == .expense ? -amount : amount }
}

struct DayBalance: Hashable {
    var deposits: [TxEntry] = []
    var expenses: [TxEntry] = []
    var endBalance: Double?     // nil = past day, no projection shown
    var isToday: Bool = false
    var isPast: Bool = false
}

enum Balance {
    /// Mirrors src/lib/balance.ts `computeAllDailyBalances`. Returns a map keyed by `YYYY-MM-DD`.
    static func computeDaily(
        startBalance: Double,
        startDate: String,
        recurring: [RecurringTransaction],
        adhoc: [AdhocTransaction],
        skipped: [SkippedOccurrence],
        cutoffDate: String,
        fromDate: String,
        toDate: String,
        today: String = Calendar.todayYMD()
    ) -> [String: DayBalance] {
        let txMap = buildTxMap(recurring: recurring, adhoc: adhoc, skipped: skipped,
                               fromDate: cutoffDate, toDate: toDate)
        let allDates = Self.dateRange(from: fromDate, to: toDate)
        var result: [String: DayBalance] = [:]

        // Adjustment: uncompleted transactions between cutoff and start that
        // aren't yet reflected in the user-entered startBalance.
        var adjustment = 0.0
        for date in allDates where date >= cutoffDate && date < startDate {
            let day = txMap[date] ?? DayBalance()
            adjustment += day.deposits.filter { !$0.skipped }.reduce(0) { $0 + $1.amount }
            adjustment -= day.expenses.filter { !$0.skipped }.reduce(0) { $0 + $1.amount }
        }

        var fwdBal = startBalance + adjustment
        for date in allDates where date >= startDate {
            let day = txMap[date] ?? DayBalance()
            let net = day.deposits.filter { !$0.skipped }.reduce(0) { $0 + $1.amount }
                    - day.expenses.filter { !$0.skipped }.reduce(0) { $0 + $1.amount }
            fwdBal += net
            let isPast = date < today
            result[date] = DayBalance(
                deposits: day.deposits,
                expenses: day.expenses,
                endBalance: isPast ? nil : fwdBal,
                isToday: date == today,
                isPast: isPast
            )
        }
        for date in allDates where date >= cutoffDate && date < startDate {
            let day = txMap[date] ?? DayBalance()
            result[date] = DayBalance(deposits: day.deposits, expenses: day.expenses,
                                      endBalance: nil, isToday: false, isPast: true)
        }
        return result
    }

    private static func buildTxMap(
        recurring: [RecurringTransaction],
        adhoc: [AdhocTransaction],
        skipped: [SkippedOccurrence],
        fromDate: String,
        toDate: String
    ) -> [String: DayBalance] {
        var map: [String: DayBalance] = [:]
        var skipMap: [String: String] = [:]   // "<txId>|<date>" → skippedId
        for s in skipped { skipMap["\(s.transaction_id)|\(s.date)"] = s.id }

        let fromParts = fromDate.split(separator: "-").compactMap { Int($0) }
        let toParts = toDate.split(separator: "-").compactMap { Int($0) }
        guard fromParts.count == 3, toParts.count == 3 else { return map }
        var (y, m) = (fromParts[0], fromParts[1])
        let (toY, toM) = (toParts[0], toParts[1])

        while y < toY || (y == toY && m <= toM) {
            for rule in recurring where rule.active != 0 {
                for date in Recurrence.expand(rule, year: y, month: m) {
                    if date < fromDate || date > toDate { continue }
                    let skippedId = skipMap["\(rule.id)|\(date)"]
                    let entry = TxEntry(
                        id: "\(rule.id)|\(date)",
                        txId: rule.id, name: rule.name, amount: rule.amount,
                        type: rule.type, source: .recurring,
                        skipped: skippedId != nil, skippedId: skippedId
                    )
                    var day = map[date] ?? DayBalance()
                    if rule.type == .deposit { day.deposits.append(entry) } else { day.expenses.append(entry) }
                    map[date] = day
                }
            }
            m += 1
            if m > 12 { m = 1; y += 1 }
        }

        for tx in adhoc {
            if tx.date < fromDate || tx.date > toDate { continue }
            let skippedId = skipMap["\(tx.id)|\(tx.date)"]
            let entry = TxEntry(
                id: "\(tx.id)|\(tx.date)",
                txId: tx.id, name: tx.name, amount: tx.amount,
                type: tx.type, source: .adhoc,
                skipped: skippedId != nil, skippedId: skippedId
            )
            var day = map[tx.date] ?? DayBalance()
            if tx.type == .deposit { day.deposits.append(entry) } else { day.expenses.append(entry) }
            map[tx.date] = day
        }

        return map
    }

    /// Inclusive YYYY-MM-DD list from `from` to `to`.
    static func dateRange(from: String, to: String) -> [String] {
        guard let start = Calendar.parseYMD(from),
              let end = Calendar.parseYMD(to), start <= end else { return [] }
        var dates: [String] = []
        var cur = start
        let cal = Calendar.gregorian
        while cur <= end {
            dates.append(Calendar.ymdString(cur))
            guard let next = cal.date(byAdding: .day, value: 1, to: cur) else { break }
            cur = next
        }
        return dates
    }
}
