import SwiftUI

extension Color {
    /// Indigo-600 from Tailwind (matches the web app's primary).
    static let bbIndigo  = Color(red: 79/255, green: 70/255, blue: 229/255)
    /// Red-500 — expense.
    static let bbExpense = Color(red: 239/255, green: 68/255, blue: 68/255)
    /// Emerald-500 — deposit / income.
    static let bbDeposit = Color(red: 16/255, green: 185/255, blue: 129/255)
    /// Amber-500 — used for the low-balance highlight.
    static let bbWarning = Color(red: 245/255, green: 158/255, blue: 11/255)
}

extension Double {
    /// Formats as `$1,234.56`. Negatives keep the leading minus.
    var asCurrency: String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 2
        return f.string(from: NSNumber(value: self)) ?? "$0.00"
    }
}
