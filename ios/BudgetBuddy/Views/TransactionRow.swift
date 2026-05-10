import SwiftUI

/// One line item in the calendar / schedule lists.
/// Owns its own swipe actions (skip on leading, edit/delete on trailing).
struct TransactionRow: View {
    let entry: TxEntry
    let date: String                            // YYYY-MM-DD this occurrence falls on
    let onToggleSkip: () -> Void
    let onTogglePaid: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    var showDate: Bool = false

    private var isDeposit: Bool { entry.type == .deposit }

    var body: some View {
        HStack(spacing: 12) {
            Capsule()
                .fill(entry.skipped ? Color.gray.opacity(0.4) : (isDeposit ? Color.bbDeposit : Color.bbExpense))
                .opacity(entry.paid && !entry.skipped ? 0.5 : 1)
                .frame(width: 3)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.body.weight(.medium))
                    .strikethrough(entry.skipped)
                    .foregroundStyle(entry.skipped ? Color.secondary : Color.primary)
                    .opacity(entry.paid && !entry.skipped ? 0.7 : 1)
                HStack(spacing: 6) {
                    Text(entry.source == .recurring ? "↻ Recurring" : "One-time")
                    if entry.skipped {
                        Text("· Skipped")
                    } else if entry.paid {
                        Text("· Paid ✓")
                    } else if showDate {
                        Text("· \(formattedDate)")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            Text(entry.signedAmount.asCurrency)
                .font(.body.weight(.semibold).monospacedDigit())
                .foregroundStyle(entry.skipped ? .secondary : (isDeposit ? Color.bbDeposit : Color.bbExpense))
                .strikethrough(entry.skipped)
                .opacity(entry.paid && !entry.skipped ? 0.7 : 1)
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button {
                onTogglePaid()
            } label: {
                Label(entry.paid ? "Unpaid" : "Paid", systemImage: entry.paid ? "arrow.uturn.backward" : "checkmark.circle")
            }
            .tint(entry.paid ? .gray : .green)
            Button {
                onToggleSkip()
            } label: {
                Label(entry.skipped ? "Unskip" : "Skip", systemImage: entry.skipped ? "arrow.uturn.backward" : "xmark.circle")
            }
            .tint(entry.skipped ? .gray : .orange)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
            Button(action: onEdit) {
                Label("Edit", systemImage: "pencil")
            }
            .tint(.gray)
        }
    }

    private var formattedDate: String {
        guard let d = Calendar.parseYMD(date) else { return date }
        return d.formatted(.dateTime.month(.abbreviated).day())
    }
}
