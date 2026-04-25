import Foundation

enum Recurrence {
    /// Returns all `YYYY-MM-DD` strings within `(year, month)` (1-indexed) when
    /// the rule fires. Mirrors src/lib/recurrence.ts line for line so the iOS
    /// calendar matches the web app's calendar exactly.
    static func expand(_ rule: RecurringTransaction, year: Int, month: Int) -> [String] {
        let cal = Calendar.gregorian
        let daysInMonth = cal.daysInMonth(year: year, month: month)

        func dateStr(_ d: Int) -> String {
            String(format: "%04d-%02d-%02d", year, month, d)
        }

        switch rule.recurrence_type {
        case .monthly_fixed:
            guard let dom = rule.day_of_month else { return [] }
            return [dateStr(min(dom, daysInMonth))]

        case .weekly:
            guard let dow = rule.day_of_week else { return [] }
            let firstDow = cal.dayOfWeek(year: year, month: month, day: 1)
            let startDay = ((dow - firstDow + 7) % 7) + 1
            return stride(from: startDay, through: daysInMonth, by: 7).map(dateStr)

        case .biweekly:
            guard let dow = rule.day_of_week,
                  let anchorStr = rule.biweekly_anchor,
                  let anchor = Calendar.parseYMD(anchorStr) else { return [] }
            let firstDow = cal.dayOfWeek(year: year, month: month, day: 1)
            let startDay = ((dow - firstDow + 7) % 7) + 1
            var result: [String] = []
            var d = startDay
            while d <= daysInMonth {
                if let candidate = cal.date(year: year, month: month, day: d) {
                    let diff = Int((candidate.timeIntervalSince(anchor) / 86_400).rounded())
                    if diff % 14 == 0 { result.append(dateStr(d)) }
                }
                d += 7
            }
            return result

        case .yearly:
            guard let m = rule.month, let dom = rule.day_of_month, m == month else { return [] }
            return [dateStr(min(dom, daysInMonth))]

        case .monthly_nth_weekday:
            guard let dow = rule.day_of_week, let nth = rule.nth_week else { return [] }
            let firstDow = cal.dayOfWeek(year: year, month: month, day: 1)
            let startDay = ((dow - firstDow + 7) % 7) + 1
            let occurrences = Array(stride(from: startDay, through: daysInMonth, by: 7))
            if nth == -1 {
                return occurrences.last.map { [dateStr($0)] } ?? []
            }
            let idx = nth - 1
            guard idx >= 0, idx < occurrences.count else { return [] }
            return [dateStr(occurrences[idx])]
        }
    }
}

extension Calendar {
    /// Gregorian calendar pinned to the user's current timezone — matches
    /// JavaScript `new Date(y, m-1, d)` behavior used in the web app.
    static var gregorian: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }

    func daysInMonth(year: Int, month: Int) -> Int {
        guard let d = date(year: year, month: month, day: 1),
              let r = range(of: .day, in: .month, for: d) else { return 30 }
        return r.count
    }

    /// Sunday=0 .. Saturday=6 (matching JavaScript `Date.getDay()`).
    func dayOfWeek(year: Int, month: Int, day: Int) -> Int {
        guard let d = date(year: year, month: month, day: day) else { return 0 }
        return component(.weekday, from: d) - 1
    }

    func date(year: Int, month: Int, day: Int) -> Date? {
        var c = DateComponents()
        c.year = year; c.month = month; c.day = day
        return self.date(from: c)
    }

    /// Parse `YYYY-MM-DD` at local midnight (matches `new Date('YYYY-MM-DDT00:00:00')`).
    static func parseYMD(_ s: String) -> Date? {
        let parts = s.split(separator: "-")
        guard parts.count == 3,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2])
        else { return nil }
        return Calendar.gregorian.date(year: y, month: m, day: d)
    }

    static func ymdString(_ d: Date) -> String {
        let c = Calendar.gregorian.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func todayYMD() -> String { ymdString(Date()) }
}
