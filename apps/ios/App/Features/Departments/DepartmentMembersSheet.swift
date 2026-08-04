import Foundation
import SwiftUI

/// Mitglieder einer Abteilung verwalten (Sheet, Mehrfachauswahl). Startwerte aus
/// dem aktuellen Roster (`department.memberIds`). Beim Speichern geht der VOLLE
/// Satz an `setDepartmentMembers` (VOLL-Replace) — nicht gewählte Personen
/// werden serverseitig aus der Abteilung entfernt. Erfolg: die aktualisierte
/// `Department` via `onSaved`, Sheet schließt; 403 als Alert, Sheet bleibt offen.
/// Web-Referenz: abteilungen/_components/DepartmentMembersSheet.tsx.
struct DepartmentMembersSheet: View {
    @StateObject private var model: DepartmentMembersViewModel
    @Environment(\.dismiss) private var dismiss
    private let departmentName: String

    init(
        department: Department,
        members: [ClubMember],
        api: APIClient,
        onSaved: @escaping (Department) -> Void
    ) {
        self.departmentName = department.name
        _model = StateObject(wrappedValue: DepartmentMembersViewModel(
            department: department, members: members, api: api, onSaved: onSaved
        ))
    }

    var body: some View {
        NavigationStack {
            content
                .background(Theme.Colors.bgCanvas.ignoresSafeArea())
                .navigationTitle(Text(verbatim: departmentName))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            dismiss()
                        } label: {
                            Text(verbatim: "Abbrechen")
                        }
                        .tint(Theme.Colors.inkSoft)
                    }
                }
                .alert(Text(verbatim: "Speichern fehlgeschlagen"), isPresented: submitErrorBinding) {
                    Button(role: .cancel) { } label: { Text(verbatim: "OK") }
                } message: {
                    Text(verbatim: model.submitError ?? "")
                }
        }
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private var content: some View {
        if model.members.isEmpty {
            ScrollView {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.2.slash",
                        title: "Keine Mitglieder",
                        message: "Dieser Verein hat noch keine Mitglieder, die du zuordnen kannst."
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        } else {
            VStack(spacing: 0) {
                headerBlock
                memberList
                saveBar
            }
        }
    }

    // MARK: - Kopf (Hinweis · Suche · Zusammenfassung)

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text(verbatim: "Tippe auf eine Person, um sie der Abteilung zuzuordnen.")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)

            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Colors.inkFaint)
                TextField(text: $model.query) {
                    Text(verbatim: "Suchen")
                }
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .accessibilityLabel(Text(verbatim: "Mitglieder durchsuchen"))
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())

            Text(verbatim: model.summary)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
                .accessibilityAddTraits(.updatesFrequently)
        }
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.top, Theme.Spacing.s4)
        .padding(.bottom, Theme.Spacing.s3)
    }

    private var memberList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(model.filteredMembers, id: \.id) { member in
                    Button {
                        model.toggle(member.id)
                    } label: {
                        DepartmentMemberSelectRow(
                            member: member,
                            selected: model.isSelected(member.id)
                        )
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Theme.Colors.line)
                }
                if model.filteredMembers.isEmpty {
                    Text(verbatim: "Niemand gefunden.")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkFaint)
                        .padding(Theme.Spacing.s6)
                }
            }
            .padding(.horizontal, Theme.Spacing.s5)
        }
    }

    private var saveBar: some View {
        RSMPrimaryButton(title: "Mitglieder speichern", isLoading: model.isSaving) {
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

/// Auswahl-Zeile: Avatar · Name · E-Mail/Jahr · Häkchen-Box.
private struct DepartmentMemberSelectRow: View {
    let member: ClubMember
    let selected: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: member.departmentsDisplayName, personId: member.id, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: member.departmentsDisplayName)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                Text(verbatim: DepartmentsFormat.memberSubtitle(member))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
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
        .accessibilityLabel(Text(verbatim: member.departmentsDisplayName))
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

// MARK: - ViewModel

@MainActor
final class DepartmentMembersViewModel: ObservableObject {

    @Published var query = ""
    @Published private(set) var selected: Set<String>
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let members: [ClubMember]
    private let department: Department
    private let api: APIClient
    private let onSaved: (Department) -> Void

    init(
        department: Department,
        members: [ClubMember],
        api: APIClient,
        onSaved: @escaping (Department) -> Void
    ) {
        self.department = department
        self.api = api
        self.onSaved = onSaved
        self.members = members.sorted { a, b in
            let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
        }
        self.selected = Set(department.memberIds)
    }

    func isSelected(_ id: String) -> Bool { selected.contains(id) }

    func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    var summary: String {
        let count = selected.count
        return count == 1 ? "1 Mitglied ausgewählt" : "\(count) Mitglieder ausgewählt"
    }

    var filteredMembers: [ClubMember] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return members }
        return members.filter { $0.departmentsDisplayName.lowercased().contains(needle) }
    }

    /// VOLL-Replace an den Server. Erfolg → `true` (Sheet schließt) + `onSaved`
    /// mit der aktualisierten Abteilung; 403/Transportfehler → `false` (Alert).
    func save() async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.setDepartmentMembers(
                departmentId: department.id,
                DepartmentMembersSet(memberIds: Array(selected))
            )
            onSaved(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? "Dazu fehlt dir die Berechtigung."
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}
