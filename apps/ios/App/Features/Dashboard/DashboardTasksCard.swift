import SwiftUI

/// Aufgaben-Karte: abhakbar per Tap auf die ganze Zeile (44-pt-Ziel).
/// Der Haken wird optimistisch gesetzt — schlägt PATCH /tasks fehl,
/// springt er zurück und die Karte zeigt den Fehler in Klartext.
struct DashboardTasksCard: View {
    let tasks: [Task]
    let pendingTaskIds: Set<String>
    let errorMessage: String?
    let onToggle: (Task) async -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "dashboard.tasks.eyebrow",
                    title: "dashboard.tasks.title"
                )
                if let errorMessage {
                    errorBanner(errorMessage)
                }
                if tasks.isEmpty {
                    RSMEmptyState(
                        systemImage: "checkmark.circle",
                        title: "dashboard.tasks.empty.title",
                        message: "dashboard.tasks.empty.message"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(tasks.enumerated()), id: \.element.id) { index, task in
                            if index > 0 {
                                Divider().overlay(Theme.Colors.line)
                            }
                            taskRow(task)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Zeile

    private func taskRow(_ task: Task) -> some View {
        let isPending = pendingTaskIds.contains(task.id)

        return Button {
            // `Task` ist hier der Contracts-Struct — Concurrency daher
            // voll qualifiziert (Konvention, s. LoginView).
            _Concurrency.Task { await onToggle(task) }
        } label: {
            HStack(alignment: .center, spacing: Theme.Spacing.s3) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(Theme.Fonts.body)
                        .strikethrough(task.done)
                        .foregroundStyle(task.done ? Theme.Colors.inkFaint : Theme.Colors.inkPrimary)
                        .multilineTextAlignment(.leading)
                    dueLabel(task)
                }
                Spacer(minLength: 0)
                if isPending {
                    ProgressView()
                        .tint(Theme.Colors.brand)
                }
            }
            .frame(minHeight: Theme.Size.touchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isPending)
        .accessibilityLabel(Text("dashboard.tasks.a11y.toggle \(task.title)"))
        .accessibilityValue(Text(task.done
            ? LocalizedStringKey("dashboard.tasks.a11y.done")
            : LocalizedStringKey("dashboard.tasks.a11y.open")))
        .accessibilityHint(Text("dashboard.tasks.a11y.hint"))
    }

    /// „fällig Sa. 12.7.“ — überfällig und noch offen wird danger.
    @ViewBuilder
    private func dueLabel(_ task: Task) -> some View {
        if let dueOn = task.dueOn, let dueDate = DashboardFormat.parseDay(dueOn) {
            let formatted =
                "\(DashboardFormat.weekdayShortText(dueDate)) \(DashboardFormat.dayMonthText(dueDate))"
            let isOverdue = !task.done
                && dueDate < Calendar.current.startOfDay(for: Date())
            if isOverdue {
                Text("dashboard.tasks.overdue \(formatted)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.danger)
            } else {
                Text("dashboard.tasks.due \(formatted)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.danger)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("dashboard.tasks.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.dangerSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
