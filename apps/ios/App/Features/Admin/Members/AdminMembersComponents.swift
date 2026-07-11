import SwiftUI

// ============================================================================
// Bausteine der Mitglieder-Verwaltung: Filter-Chip (mit Zähler), Listenzeile,
// Beitragsampel und das Eingabefeld-Chrome des Bearbeiten-Sheets.
// Alle Typen tragen das „Admin…"-Präfix (Kollisionsschutz Parallel-Teams).
// ============================================================================

// MARK: - Filter-Chip (Titel + optionaler Zähler)

/// Pill-Filter im Heimspiel-Look: ausgewählt = brand-soft-Tint. Der Zähler
/// steht als Mono-Zahl rechts (tabular), damit die Chips ruhig bleiben.
struct AdminMembersFilterChip: View {
    let title: LocalizedStringKey
    let count: Int?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(title)
                    .font(Theme.Fonts.caption.weight(.semibold))
                if let count {
                    Text(verbatim: "\(count)")
                        .font(Theme.Fonts.mono(size: 11.5))
                        .monospacedDigit()
                        .foregroundStyle(isSelected ? Theme.Colors.brandInk : Theme.Colors.inkFaint)
                }
            }
            .foregroundStyle(isSelected ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(isSelected ? Theme.Colors.brandSoft : Theme.Colors.bgSurface)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(
                    isSelected ? Theme.Colors.brandInk : Theme.Colors.line,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Beitragsampel

/// Beitragsampel: Mahnstufen-Treppe des Design-Systems bzw. „bezahlt".
struct AdminMembersFeePill: View {
    let status: AdminMembersViewModel.FeeStatus

    var body: some View {
        switch status {
        case .dunning(let level):
            RSMStatusPill.dunning(level: level)
        case .paid:
            RSMStatusPill(text: "mitglieder.fee.paid", kind: .success)
        }
    }
}

// MARK: - Listenzeile

/// Zeile der Mitglieder-Verwaltung: Avatar · Name + Team · Rollen-Pille
/// (+ Gasttrainer-Befristung) · Beitragsampel. Tippbar, wenn bearbeitbar.
struct AdminMembersRow: View {
    let member: ClubMember
    let teamNames: String?
    let feeStatus: AdminMembersViewModel.FeeStatus?
    let isEditable: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: member.adminMembersDisplayName, personId: member.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: member.adminMembersDisplayName)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                if let teamNames {
                    Text(verbatim: teamNames)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(1)
                } else {
                    Text("mitglieder.row.noTeam")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
            Spacer(minLength: Theme.Spacing.s2)
            VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                RSMStatusPill(
                    text: AdminMembersL10n.roleKey(member.role),
                    kind: AdminMembersL10n.roleKind(member.role)
                )
                if member.role == .guestCoach, let until = member.validUntil {
                    RSMStatusPill(
                        text: "mitglieder.guestUntil \(AdminMembersFormat.short(until))",
                        kind: .warn
                    )
                }
                if let feeStatus {
                    AdminMembersFeePill(status: feeStatus)
                }
            }
            if isEditable {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
        }
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
    }
}

// MARK: - Eingabefeld-Chrome (feature-eigen)

/// Einheitliches Eingabefeld-Chrome: Body-Schrift, Mulden-Fläche, Radius M.
struct AdminMembersFieldChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}

/// Feld-Gerüst: Label · Inhalt · optionaler Hinweis · optionaler Fehler.
struct AdminMembersFieldGroup<Content: View>: View {
    let label: LocalizedStringKey
    var hint: LocalizedStringKey?
    var error: LocalizedStringKey?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            content
            if let error {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            } else if let hint {
                Text(hint)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Optionales Datumsfeld: Schalter „gesetzt" + kompakter DatePicker. Aus ⇒ nil.
/// (Leerungen bestehender Werte erreichen den Server derzeit nicht — siehe
/// gemeldete Contract-Lücke in `AdminMemberEditViewModel.buildPatch`.)
struct AdminMembersDateField: View {
    let toggleLabel: LocalizedStringKey
    @Binding var date: Date?

    private var isOn: Binding<Bool> {
        Binding(
            get: { date != nil },
            set: { on in date = on ? (date ?? Date()) : nil }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Toggle(isOn: isOn) {
                Text(toggleLabel)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            .tint(Theme.Colors.brand)
            if date != nil {
                DatePicker(
                    "",
                    selection: Binding(get: { date ?? Date() }, set: { date = $0 }),
                    displayedComponents: .date
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .tint(Theme.Colors.brand)
            }
        }
    }
}
