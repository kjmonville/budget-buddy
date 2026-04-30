import SwiftUI
import Charts

/// Compact end-of-day balance forecast with scale picker and drag-to-scrub.
struct ForecastChart: View {
    let dailyBalances: [String: DayBalance]
    let lowDate: String?

    @State private var selectedDays: Int = 30
    @State private var scrubDate: Date? = nil
    @State private var scrubBalance: Double? = nil
    @State private var isScrubbing: Bool = false

    private let scaleOptions = [7, 30, 60, 90]

    var body: some View {
        let pts = points()
        let yMin = pts.map(\.balance).min() ?? 0
        let yMax = pts.map(\.balance).max() ?? 0
        let yPad = max(1, (yMax - yMin) * 0.15)

        VStack(spacing: 6) {
            Picker("Range", selection: $selectedDays) {
                ForEach(scaleOptions, id: \.self) { d in
                    Text("\(d)d").tag(d)
                }
            }
            .pickerStyle(.segmented)

            // Fixed-height scrub info row — opacity-toggled so the chart never shifts
            HStack {
                if let d = scrubDate, let b = scrubBalance {
                    Text(d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(b.asCurrency)
                        .font(.caption.monospacedDigit().bold())
                }
            }
            .frame(height: 16)
            .opacity(isScrubbing ? 1 : 0)

            Chart {
                ForEach(pts) { p in
                    LineMark(
                        x: .value("Day", p.date),
                        y: .value("Balance", p.balance)
                    )
                    .foregroundStyle(Color.primary)
                    .interpolationMethod(.monotone)

                    if Calendar.ymdString(p.date) == lowDate {
                        PointMark(
                            x: .value("Day", p.date),
                            y: .value("Balance", p.balance)
                        )
                        .foregroundStyle(Color.bbWarning)
                        .symbolSize(80)
                        .annotation(position: .top) {
                            if !isScrubbing {
                                Text(p.balance.asCurrency)
                                    .font(.caption2.bold())
                                    .foregroundStyle(Color.bbWarning)
                            }
                        }
                    }
                }

                if isScrubbing, let sd = scrubDate {
                    RuleMark(x: .value("Scrub", sd))
                        .foregroundStyle(Color.primary.opacity(0.18))
                        .lineStyle(StrokeStyle(lineWidth: 1))
                }

                if isScrubbing, let sd = scrubDate, let sb = scrubBalance {
                    PointMark(
                        x: .value("Scrub", sd),
                        y: .value("Balance", sb)
                    )
                    .foregroundStyle(Color.primary)
                    .symbolSize(40)
                    .symbol(.circle)
                }
            }
            .chartYScale(domain: (yMin - yPad)...(yMax + yPad))
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: max(1, selectedDays / 6))) { value in
                    if let date = value.as(Date.self) {
                        AxisValueLabel {
                            Text(Calendar.gregorian.component(.day, from: date), format: .number)
                                .font(.caption2)
                        }
                    }
                }
            }
            .chartYAxis(.hidden)
            .frame(height: 120)
            .chartOverlay { proxy in
                GeometryReader { geo in
                    Rectangle()
                        .fill(Color.clear)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { value in
                                    updateScrub(at: value.location, proxy: proxy, geo: geo, pts: pts)
                                }
                                .onEnded { _ in
                                    isScrubbing = false
                                    scrubDate = nil
                                    scrubBalance = nil
                                }
                        )
                }
            }
        }
        .padding(.horizontal)
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
        for offset in 0..<selectedDays {
            guard let d = cal.date(byAdding: .day, value: offset, to: start) else { continue }
            let key = Calendar.ymdString(d)
            if let day = dailyBalances[key], let b = day.endBalance {
                result.append(Point(id: key, date: d, balance: b))
            }
        }
        return result
    }

    private func updateScrub(at location: CGPoint, proxy: ChartProxy, geo: GeometryProxy, pts: [Point]) {
        guard let frame = proxy.plotFrame else { return }
        let relativeX = location.x - geo[frame].minX
        guard let date: Date = proxy.value(atX: relativeX, as: Date.self) else { return }
        guard let closest = pts.min(by: {
            abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date))
        }) else { return }
        scrubDate = closest.date
        scrubBalance = closest.balance
        isScrubbing = true
    }
}
