import SwiftUI
import Charts

/// Compact end-of-day balance forecast — used in the calendar header.
struct ForecastChart: View {
    let dailyBalances: [String: DayBalance]
    let lowDate: String?
    let days: Int

    var body: some View {
        let pts = points()
        let yMin = pts.map(\.balance).min() ?? 0
        let yMax = pts.map(\.balance).max() ?? 0
        let yPad = max(1, (yMax - yMin) * 0.15)

        Chart {
            ForEach(pts) { p in
                LineMark(
                    x: .value("Day", p.date),
                    y: .value("Balance", p.balance)
                )
                .foregroundStyle(Color.primary)
                .interpolationMethod(.monotone)

                if p.date == lowDate {
                    PointMark(
                        x: .value("Day", p.date),
                        y: .value("Balance", p.balance)
                    )
                    .foregroundStyle(Color.bbWarning)
                    .symbolSize(80)
                    .annotation(position: .top) {
                        Text(p.balance.asCurrency)
                            .font(.caption2.bold())
                            .foregroundStyle(Color.bbWarning)
                    }
                }
            }
        }
        .chartYScale(domain: (yMin - yPad)...(yMax + yPad))
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: max(1, days / 6))) { value in
                if let date = value.as(Date.self) {
                    AxisValueLabel {
                        Text(Calendar.gregorian.component(.day, from: date), format: .number)
                            .font(.caption2)
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .frame(height: 90)
    }

    private struct Point: Identifiable {
        let id: String
        let date: Date
        let balance: Double
    }

    private func points() -> [Point] {
        let today = Calendar.todayYMD()
        guard let start = Calendar.parseYMD(today) else { return [] }
        let cal = Calendar.gregorian
        var result: [Point] = []
        for offset in 0..<days {
            guard let d = cal.date(byAdding: .day, value: offset, to: start) else { continue }
            let key = Calendar.ymdString(d)
            if let day = dailyBalances[key], let b = day.endBalance {
                result.append(Point(id: key, date: d, balance: b))
            }
        }
        return result
    }
}
