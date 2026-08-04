import Foundation
import SwiftUI

/// Sparte EINES Teams zuordnen/ändern (Sheet, EINFACH-Auswahl — ein Team gehört
/// zu genau EINER Sparte). „Keiner Sparte" ist eine explizite Option (löst die
/// Zuordnung). Beim Speichern geht die Auswahl über `setTeamSparte` an den
/// Server (`sparteId == nil` = lösen). Erfolg: aktualisiertes `Team` via
/// `onSaved`, Sheet schließt; 403/Transportfehler als Alert, Sheet bleibt offen.
///
/// Web-Referenz: teams/[id]/TeamSparteSheet.tsx. Sichtbar nur für
/// `can_manage_sparten` — das Gate sitzt im aufrufenden `TeamDetailView`.
struct TeamSparteSheet: View {
    @StateObject private var model: TeamSparteSheetViewModel
    @Environment(\.dismiss) private var dismiss
    private let teamName: String

    init(
        team: Team,
        sparten: [Sparte],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Team) -> Void
    ) {
        self.teamName = team.name
        _model = StateObject(wrappedValue: TeamSparteSheetViewModel(
            team: team,
            sparten: sparten,
            api: api,
            clubId: clubId,
            onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            content
                .background(Theme.Colors.bgCanvas.ignoresSafeArea())
                .navigationTitle(Text(verbatim: teamName))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("teams.form.cancel") { dismiss() }
                            .tint(Theme.Colors.inkSoft)
                    }
                }
                .alert("teams.error.title", isPresented: submitErrorBinding) {
                    Button("teams.error.ok", role: .cancel) {}
                } message: {
                    Text(verbatim: model.submitError ?? "")
                }
        }
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var content: some View {
        if model.sparten.isEmpty {
            ScrollView {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "sparkles",
                        title: "Keine Sparten vorhanden",
                        message: "Lege zuerst eine Sparte an, um dieses Team zuzuordnen."
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        } else {
            VStack(spacing: 0) {
                header
                list
                saveBar
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: "Ordne dieses Team genau einer Sparte zu — oder keiner.")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.top, Theme.Spacing.s4)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Explizite „Keiner Sparte"-Option zuerst (löst die Zuordnung).
                Button {
                    model.select(nil)
                } label: {
                    SparteRadioRow.none(selected: model.isSelected(nil))
                }
                .buttonStyle(.plain)
                Divider().overlay(Theme.Colors.line)

                ForEach(model.sparten, id: \.id) { sparte in
                    Button {
                        model.select(sparte.id)
                    } label: {
                        SparteRadioRow(
                            sparte: sparte,
                            selected: model.isSelected(sparte.id)
                        )
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Theme.Colors.line)
                }
            }
            .padding(.horizontal, Theme.Spacing.s5)
        }
    }

    private var saveBar: some View {
        RSMPrimaryButton(title: "Sparte speichern", isLoading: model.isSaving) {
            _Concurrency.Task {
                if await model.save() { dismiss() }
            }
        }
        .padding(Theme.Spacing.s5)
        .background(Theme.Colors.bgSurface.ignoresSafeArea(edges: .bottom))
    }

    private var submitErrorBinding: Binding<Bool> {
        Binding(
            get: { model.submitError != nil },
            set: { if !$0 { model.submitError = nil } }
        )
    }
}

/// Auswahl-Zeile mit Radio-Punkt (Einfachauswahl): Icon-Chip · Name (+ „Inaktiv")
/// · Radio. Für „Keiner Sparte" gibt es die Fabrik `none(selected:)`.
private struct SparteRadioRow: View {
    let sparte: Sparte?
    let selected: Bool

    /// „Keiner Sparte"-Zeile (neutraler Chip, kein Sparten-Bezug).
    static func none(selected: Bool) -> SparteRadioRow {
        SparteRadioRow(sparte: nil, selected: selected)
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            iconChip
            Text(verbatim: sparte?.name ?? "Keiner Sparte")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(1)
            if let sparte, !sparte.aktiv {
                RSMStatusPill(text: "sparten.badge.inactive", kind: .neutral)
            }
            Spacer(minLength: Theme.Spacing.s2)
            radio
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: sparte?.name ?? "Keiner Sparte"))
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    @ViewBuilder
    private var iconChip: some View {
        if let sparte {
            let accent = SparteColorCatalog.color(for: sparte.farbe)
            Image(systemName: SparteIconCatalog.symbol(for: sparte.icon))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 36, height: 36)
                .background(accent.opacity(0.16))
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous))
                .accessibilityHidden(true)
        } else {
            Image(systemName: "xmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(width: 36, height: 36)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous))
                .accessibilityHidden(true)
        }
    }

    private var radio: some View {
        ZStack {
            Circle()
                .strokeBorder(selected ? Theme.Colors.brand : Theme.Colors.line, lineWidth: 2)
            if selected {
                Circle()
                    .fill(Theme.Colors.brand)
                    .frame(width: 12, height: 12)
            }
        }
        .frame(width: 24, height: 24)
    }
}

// MARK: - ViewModel

@MainActor
final class TeamSparteSheetViewModel: ObservableObject {

    /// Aktuell gewählte Sparte-ID (`nil` = „Keiner Sparte").
    @Published private(set) var selected: String?
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let sparten: [Sparte]
    private let teamId: String
    /// Ausgangs-Zuordnung — ist die Auswahl unverändert, spart das Speichern
    /// den Server-Call und schließt einfach.
    private let originalSparteId: String?
    private let api: APIClient
    private let clubId: String
    private let onSaved: (Team) -> Void

    init(
        team: Team,
        sparten: [Sparte],
        api: APIClient,
        clubId: String,
        onSaved: @escaping (Team) -> Void
    ) {
        self.teamId = team.id
        self.originalSparteId = team.sparteId
        self.selected = team.sparteId
        self.sparten = sparten
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
    }

    func isSelected(_ id: String?) -> Bool { selected == id }

    func select(_ id: String?) { selected = id }

    /// Auswahl an den Server. Unverändert → `true` (Sheet schließt, kein Call).
    /// Erfolg → `true` + `onSaved` mit dem aktualisierten Team; 403/Transport →
    /// `false` (Alert, Sheet bleibt offen).
    func save() async -> Bool {
        guard !isSaving else { return false }
        guard selected != originalSparteId else { return true }

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.setTeamSparte(
                clubId: clubId,
                teamId: teamId,
                TeamSparteSet(sparteId: selected)
            )
            onSaved(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("sparten.error.forbidden", comment: "403 bei Team-Sparte-Zuordnung")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
