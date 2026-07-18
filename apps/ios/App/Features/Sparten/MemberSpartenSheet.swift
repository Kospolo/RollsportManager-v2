import Foundation
import SwiftUI

/// Sparten-Zuordnung EINES Mitglieds (Sheet, Mehrfachauswahl). Startwerte aus
/// der aktuellen Zugehörigkeit (`sparte.memberIds` enthält die memberId). Beim
/// Speichern wird pro GEÄNDERTER Sparte der Roster als Voll-Replace gesetzt
/// (PUT …/sparten/{id}/members) — die n:m-Wahrheit lebt auf der Sparte, deshalb
/// der Diff je Sparte. Erfolg: die aktualisierten Sparten via `onSaved`, Sheet
/// schließt; 403 als Alert, Sheet bleibt offen.
/// Web-Referenz: mitglieder/[id]/MemberSpartenSheet.tsx.
struct MemberSpartenSheet: View {
    @StateObject private var model: MemberSpartenSheetViewModel
    @Environment(\.dismiss) private var dismiss
    private let memberName: String

    init(
        memberId: String,
        memberName: String,
        sparten: [Sparte],
        api: APIClient,
        clubId: String,
        onSaved: @escaping ([Sparte]) -> Void
    ) {
        self.memberName = memberName
        _model = StateObject(wrappedValue: MemberSpartenSheetViewModel(
            memberId: memberId,
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
                .navigationTitle(Text("member.sparten.sheet.title"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("sparten.form.cancel") { dismiss() }
                            .tint(Theme.Colors.inkSoft)
                    }
                }
                .alert("sparten.error.title", isPresented: submitErrorBinding) {
                    Button("sparten.error.ok", role: .cancel) {}
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
                        title: "member.sparten.sheet.emptyTitle",
                        message: "member.sparten.sheet.emptyMessage"
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
            Text("member.sparten.sheet.hint \(memberName)")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            Text("member.sparten.sheet.summary \(model.selectedCount)")
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityAddTraits(.updatesFrequently)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.top, Theme.Spacing.s4)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(model.sparten, id: \.id) { sparte in
                    Button {
                        model.toggle(sparte.id)
                    } label: {
                        SparteSelectRow(
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
        RSMPrimaryButton(title: "member.sparten.sheet.save", isLoading: model.isSaving) {
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

/// Auswahl-Zeile: Icon-Chip · Name (+ „Inaktiv") · Häkchen-Box.
private struct SparteSelectRow: View {
    let sparte: Sparte
    let selected: Bool

    private var accent: Color { SparteColorCatalog.color(for: sparte.farbe) }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Image(systemName: SparteIconCatalog.symbol(for: sparte.icon))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 36, height: 36)
                .background(accent.opacity(0.16))
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous))
                .accessibilityHidden(true)
            Text(verbatim: sparte.name)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(1)
            if !sparte.aktiv {
                RSMStatusPill(text: "sparten.badge.inactive", kind: .neutral)
            }
            Spacer(minLength: Theme.Spacing.s2)
            ZStack {
                RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                    .fill(selected ? Theme.Colors.brand : Color.clear)
                RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                    .strokeBorder(selected ? Theme.Colors.brand : Theme.Colors.line, lineWidth: 1.5)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Colors.brandContrast)
                }
            }
            .frame(width: 24, height: 24)
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: sparte.name))
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

// MARK: - ViewModel

@MainActor
final class MemberSpartenSheetViewModel: ObservableObject {

    @Published private(set) var selected: Set<String>
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let sparten: [Sparte]
    private let memberId: String
    private let api: APIClient
    private let clubId: String
    private let onSaved: ([Sparte]) -> Void

    init(
        memberId: String,
        sparten: [Sparte],
        api: APIClient,
        clubId: String,
        onSaved: @escaping ([Sparte]) -> Void
    ) {
        self.memberId = memberId
        self.sparten = sparten
        self.api = api
        self.clubId = clubId
        self.onSaved = onSaved
        self.selected = Set(sparten.filter { $0.memberIds.contains(memberId) }.map(\.id))
    }

    func isSelected(_ id: String) -> Bool { selected.contains(id) }
    var selectedCount: Int { selected.count }

    func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    /// Nur GEÄNDERTE Sparten anfassen: Diff zwischen Ist (`memberIds`) und Soll
    /// (`selected`). Pro Änderung ein Roster-Voll-Replace. Erfolg → `true`
    /// (Sheet schließt) + `onSaved` mit den aktualisierten Sparten.
    func save() async -> Bool {
        guard !isSaving else { return false }
        let changed = sparten.filter { selected.contains($0.id) != $0.memberIds.contains(memberId) }
        guard !changed.isEmpty else { return true } // nichts geändert → schließen

        isSaving = true
        defer { isSaving = false }
        do {
            var updated: [Sparte] = []
            for sparte in changed {
                let nextMembers: [String] = selected.contains(sparte.id)
                    ? sparte.memberIds + [memberId]
                    : sparte.memberIds.filter { $0 != memberId }
                let result = try await api.setSparteMembers(
                    clubId: clubId,
                    sparteId: sparte.id,
                    SparteMembersSet(memberIds: nextMembers)
                )
                updated.append(result)
            }
            onSaved(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("sparten.error.forbidden", comment: "403 bei Sparten-Zuordnung")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
