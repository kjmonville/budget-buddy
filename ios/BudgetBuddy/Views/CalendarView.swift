import SwiftUI

/// Home screen — Calendar V3 from the wireframes:
/// header with Today's / Low Balance, forecast chart, then upcoming list.
struct CalendarView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(AppStore.self) private var store
    @Environment(\.api) private var apiOpt

    @State private var balanceDraft: String = ""
    @State private var balanceEditing = false
    @State private var addOpen = false
    @State private var editingRecurring: RecurringTransaction?
    @State private var editingAdhoc: AdhocTransaction?
    @State private var scheduleOpen = false
    @State private var deleteCandidate: DeleteCandidate?

    private var api: APIClient {
        apiOpt ?? APIClient(baseURL: Config.apiBase, auth: auth)
    }

    var body: some View {
        NavigationStack {
            List {
                headerCard
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                if let api = apiOpt {
                    if !store.upcomingFlat.isEmpty {
                        ForecastChart(
                            dailyBalances: store.dailyBalances,
                            lowDate: store.lowestBalance?.date,
                            days: 30
                        )
                        .padding(.horizontal)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    upcomingList(api: api)
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Budget Buddy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Schedule") { scheduleOpen = true }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Add transaction", systemImage: "plus") { addOpen = true }
                        Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                            auth.logout()
                            store.reset()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .refreshable { await store.load(api: api) }
            .sheet(isPresented: $addOpen) {
                AddTransactionSheet(api: api, initialDate: nil)
            }
            .sheet(item: $editingRecurring) { rule in
                EditTransactionSheet(api: api, editing: .recurring(rule))
            }
            .sheet(item: $editingAdhoc) { tx in
                EditTransactionSheet(api: api, editing: .adhoc(tx))
            }
            .sheet(isPresented: $scheduleOpen) {
                ScheduleView(
                    api: api,
                    onEditRecurring: { editingRecurring = $0; scheduleOpen = false },
                    onEditAdhoc: { editingAdhoc = $0; scheduleOpen = false }
                )
            }
            .confirmationDialog(
                "Delete?",
                isPresented: Binding(get: { deleteCandidate != nil }, set: { if !$0 { deleteCandidate = nil } }),
                presenting: deleteCandidate
            ) { c in
                Button(c.recurringMessage ?? "Delete", role: .destructive) {
                    Task { await performDelete(c) }
                }
                if c.entry.source == .recurring {
                    Button("Skip just this occurrence") {
                        Task { await toggleSkip(c.entry, date: c.date) }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { c in
                Text(c.entry.source == .recurring
                     ? "This is a recurring transaction. Delete the entire series, or skip only this occurrence?"
                     : "Delete \"\(c.entry.name)\"?")
            }
            .alert("Error", isPresented: Binding(
                get: { store.lastError != nil },
                set: { if !$0 { store.lastError = nil } }
            )) {
                Button("OK") {}
            } message: {
                Text(store.lastError ?? "")
            }
        }
    }

    // MARK: - Header card

    private var headerCard: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Today's Balance")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if balanceEditing {
                        TextField("0.00", text: $balanceDraft)
                            .keyboardType(.decimalPad)
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .submitLabel(.done)
                            .onSubmit { commitBalance() }
                    } else {
                        Button {
                            balanceDraft = String(format: "%.2f", store.balance.amount)
                            balanceEditing = true
                        } label: {
                            Text(store.balance.amount.asCurrency)
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.primary)
                        }
                    }
                    if let d = store.balance.balance_date {
                        Text("as of \(formatDate(d))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let low = store.lowestBalance {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Low balance")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(low.amount.asCurrency)
                            .font(.title3.bold().monospacedDigit())
                            .foregroundStyle(low.amount < 0 ? Color.bbExpense : Color.bbWarning)
                        Text("on \(formatDate(low.date))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            if balanceEditing {
                HStack {
                    Button("Cancel") { balanceEditing = false }
                    Spacer()
                    Button("Save") { commitBalance() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.bbIndigo)
                }
                .font(.subheadline)
            }
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Upcoming list

    @ViewBuilder
    private func upcomingList(api: APIClient) -> some View {
        let groups = store.upcomingByDay()
        if groups.isEmpty {
            ContentUnavailableView(
                "No upcoming transactions",
                systemImage: "calendar",
                description: Text("Tap the menu in the top-right to add one.")
            )
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        } else {
            ForEach(groups, id: \.date) { group in
                Section {
                    ForEach(group.entries) { entry in
                        TransactionRow(
                            entry: entry,
                            date: group.date,
                            onToggleSkip: { Task { await toggleSkip(entry, date: group.date) } },
                            onEdit: { startEdit(entry: entry) },
                            onDelete: { deleteCandidate = DeleteCandidate(entry: entry, date: group.date) }
                        )
                    }
                } header: {
                    HStack {
                        Text(formatDate(group.date))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(
                                store.dailyBalances[group.date]?.isPast == true
                                    ? Color.bbWarning : Color.primary
                            )
                        Spacer()
                        if let bal = store.dailyBalances[group.date]?.endBalance {
                            Text(bal.asCurrency)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    // MARK: - Actions

    private func commitBalance() {
        let cleaned = balanceDraft.replacingOccurrences(of: ",", with: "")
        guard let amt = Double(cleaned) else {
            balanceEditing = false
            return
        }
        let today = Calendar.todayYMD()
        store.balance = AccountBalance(amount: amt, balance_date: today,
                                       updated_at: store.balance.updated_at,
                                       cutoff_date: store.balance.cutoff_date)
        balanceEditing = false
        Task {
            do { try await api.setBalance(amount: amt, balanceDate: today) }
            catch { store.lastError = (error as? LocalizedError)?.errorDescription }
        }
    }

    private func toggleSkip(_ entry: TxEntry, date: String) async {
        do {
            if entry.skipped, let sid = entry.skippedId {
                try await api.unskip(id: sid)
                store.skipped.removeAll { $0.id == sid }
            } else {
                let created = try await api.skip(transactionId: entry.txId, kind: entry.source.rawValue, date: date)
                store.skipped.append(created)
            }
        } catch {
            store.lastError = (error as? LocalizedError)?.errorDescription
        }
    }

    private func startEdit(entry: TxEntry) {
        if entry.source == .recurring,
           let r = store.recurring.first(where: { $0.id == entry.txId }) {
            editingRecurring = r
        } else if entry.source == .adhoc,
                  let a = store.adhoc.first(where: { $0.id == entry.txId }) {
            editingAdhoc = a
        }
    }

    private func performDelete(_ c: DeleteCandidate) async {
        do {
            switch c.entry.source {
            case .recurring:
                try await api.deleteRecurring(id: c.entry.txId)
                store.recurring.removeAll { $0.id == c.entry.txId }
            case .adhoc:
                try await api.deleteAdhoc(id: c.entry.txId)
                store.adhoc.removeAll { $0.id == c.entry.txId }
            }
        } catch {
            store.lastError = (error as? LocalizedError)?.errorDescription
        }
    }

    private func formatDate(_ ymd: String) -> String {
        guard let d = Calendar.parseYMD(ymd) else { return ymd }
        if ymd == Calendar.todayYMD() { return "Today" }
        return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}

private struct DeleteCandidate: Identifiable {
    let id = UUID()
    let entry: TxEntry
    let date: String
    var recurringMessage: String? {
        entry.source == .recurring ? "Delete entire series" : nil
    }
}

// MARK: - AppStore convenience

extension AppStore {
    /// Flat ordered list of upcoming entries (today onward), for chart visibility checks.
    var upcomingFlat: [TxEntry] {
        upcomingByDay().flatMap(\.entries)
    }

    func upcomingByDay() -> [(date: String, entries: [TxEntry])] {
        let today = Calendar.todayYMD()

        // Past days: only surface un-skipped entries so the user can acknowledge them
        let past = dailyBalances
            .filter { $0.key < today }
            .sorted { $0.key < $1.key }
            .compactMap { (date, day) -> (String, [TxEntry])? in
                let unskipped = (day.deposits + day.expenses).filter { !$0.skipped }
                return unskipped.isEmpty ? nil : (date, unskipped)
            }

        let upcoming = dailyBalances
            .filter { $0.key >= today }
            .sorted { $0.key < $1.key }
            .compactMap { (date, day) -> (String, [TxEntry])? in
                let entries = day.deposits + day.expenses
                return entries.isEmpty ? nil : (date, entries)
            }

        return past + Array(upcoming.prefix(60))
    }
}
