import Foundation
import Observation

@Observable
@MainActor
final class AppStore {
    var balance: AccountBalance = .empty { didSet { recomputeDailyBalances() } }
    var recurring: [RecurringTransaction] = [] { didSet { recomputeDailyBalances() } }
    var adhoc: [AdhocTransaction] = [] { didSet { recomputeDailyBalances() } }
    var skipped: [SkippedOccurrence] = [] { didSet { recomputeDailyBalances() } }

    var loading = false
    var lastError: String?

    private(set) var dailyBalances: [String: DayBalance] = [:]
    private(set) var lowestBalance: (amount: Double, date: String)?

    /// Forecast window: 3 months back, 18 months forward — same range the web app uses.
    private var fromDate: String {
        let cal = Calendar.gregorian
        let from = cal.date(byAdding: .month, value: -3, to: Date()) ?? Date()
        let firstOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: from)) ?? from
        return Calendar.ymdString(firstOfMonth)
    }
    private var toDate: String {
        let cal = Calendar.gregorian
        let to = cal.date(byAdding: .month, value: 19, to: Date()) ?? Date()
        let firstOfNext = cal.date(from: cal.dateComponents([.year, .month], from: to)) ?? to
        let lastOfPrev = cal.date(byAdding: .day, value: -1, to: firstOfNext) ?? to
        return Calendar.ymdString(lastOfPrev)
    }

    func load(api: APIClient) async {
        loading = true
        lastError = nil
        do {
            async let b = api.getBalance()
            async let r = api.getRecurring()
            async let a = api.getAdhoc()
            async let s = api.getSkipped()
            let (bal, rec, adh, skp) = try await (b, r, a, s)
            self.balance = bal
            self.recurring = rec
            self.adhoc = adh
            self.skipped = skp
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        loading = false
    }

    func reset() {
        balance = .empty
        recurring = []
        adhoc = []
        skipped = []
        lastError = nil
    }

    private func recomputeDailyBalances() {
        let today = Calendar.todayYMD()
        let anchor = balance.balance_date ?? today
        let cutoff = balance.cutoff_date ?? String(today.prefix(7)) + "-01"
        dailyBalances = Balance.computeDaily(
            startBalance: balance.amount,
            startDate: anchor,
            recurring: recurring,
            adhoc: adhoc,
            skipped: skipped,
            cutoffDate: cutoff,
            fromDate: fromDate,
            toDate: toDate
        )
        var best: (Double, String)?
        for (date, day) in dailyBalances {
            guard let v = day.endBalance else { continue }
            if best == nil || v < best!.0 { best = (v, date) }
        }
        lowestBalance = best.map { (amount: $0.0, date: $0.1) }
    }
}
