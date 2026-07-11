import SwiftUI

/// Selbst-Eintrag in eine Warteliste (Web-Referenz: JoinWaitlistDialog.tsx).
/// Art wählen, optional ein konkretes Ziel (Halle/Ausrüstung) und eine Notiz.
/// Sind für die Art keine Ziele hinterlegt, bleibt der allgemeine Eintrag
/// möglich. Erfolg: Dialog schließt (das ViewModel lädt neu); Fehler/403 zeigt
/// das ViewModel als Alert im Eltern-Screen. Autorisierung bleibt serverseitig.
struct WaitlistJoinSheet: View {
    @ObservedObject var viewModel: WaitlistsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var kind: WaitlistKind = .facility
    @State private var targetId: String = ""
    @State private var note: String = ""

    private var options: [WaitlistTargetOption] {
        viewModel.targetSources.options(for: kind)
    }

    private var selectedTargetLabel: LocalizedStringKey {
        if let match = options.first(where: { $0.id == targetId }) {
            return LocalizedStringKey(match.label)
        }
        return "wartelisten.field.target.general"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s6) {
                    kindSection
                    targetSection
                    noteSection
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("wartelisten.join.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("wartelisten.cancel") { dismiss() }
                        .disabled(viewModel.isMutating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("wartelisten.join.submit") { submit() }
                        .fontWeight(.bold)
                        .disabled(viewModel.isMutating)
                }
            }
        }
    }

    // MARK: - Abschnitte

    private var kindSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            fieldLabel("wartelisten.field.kind")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s2) {
                    ForEach(WaitlistKind.displayOrder, id: \.self) { option in
                        kindChip(option)
                    }
                }
                .padding(.horizontal, Theme.Spacing.s1)
            }
        }
    }

    private func kindChip(_ option: WaitlistKind) -> some View {
        let isActive = kind == option
        return Button {
            kind = option
            targetId = ""
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: option.systemImage)
                    .font(.system(size: 12, weight: .semibold))
                    .accessibilityHidden(true)
                Text(option.labelKey)
            }
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(isActive ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(isActive ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }

    @ViewBuilder
    private var targetSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            fieldLabel("wartelisten.field.target")
            if options.isEmpty {
                Text("wartelisten.field.target.unavailable")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Menu {
                    Button { targetId = "" } label: { Text("wartelisten.field.target.general") }
                    ForEach(options) { option in
                        Button { targetId = option.id } label: { Text(verbatim: option.label) }
                    }
                } label: {
                    HStack {
                        Text(selectedTargetLabel)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                    .font(Theme.Fonts.body)
                    .padding(.horizontal, Theme.Spacing.s4)
                    .frame(minHeight: Theme.Size.touchTarget)
                    .background(Theme.Colors.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .stroke(Theme.Colors.line, lineWidth: 1)
                    )
                }
            }
        }
    }

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            fieldLabel("wartelisten.field.note")
            TextField("wartelisten.field.note.placeholder", text: $note, axis: .vertical)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(3...6)
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                        .stroke(Theme.Colors.line, lineWidth: 1)
                )
        }
    }

    private func fieldLabel(_ key: LocalizedStringKey) -> some View {
        Text(key)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Colors.inkFaint)
    }

    // MARK: - Aktion

    private func submit() {
        _Concurrency.Task {
            let ok = await viewModel.join(
                kind: kind,
                targetId: targetId.isEmpty ? nil : targetId,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            if ok { dismiss() }
        }
    }
}
