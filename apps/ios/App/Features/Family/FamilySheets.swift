import SwiftUI

// ============================================================================
// Schreib-Sheets des Familie-Features (Selfservice). Spiegeln die Web-Referenz
// (portal)/familie/_components: CreateChildDialog + LinkChildSheet. Muster wie
// die Anlegen-Sheets in Admin/QuickCreateSheets: Form in NavigationStack,
// Abbrechen/Anlegen in der Toolbar, Fehler als APIError-Klartext inline.
//
// Alle Typen sind mit „Family…" präfixiert (Kollisionsschutz Parallel-Teams).
// ============================================================================

/// APIError → Klartext (403/422 werden zur verständlichen Meldung), wie überall
/// im Familie-Feature.
private func familyErrorText(_ error: Error) -> String {
    (error as? APIError)?.errorDescription ?? error.localizedDescription
}

/// Beziehungscode → deutsches Label (Selfservice kennt parent/guardian/other).
private func familyRelationLabel(_ raw: String) -> String {
    switch raw {
    case "parent": return "Elternteil"
    case "guardian": return "Erziehungsberechtigte:r"
    case "other": return "Bezugsperson"
    default: return "Bezugsperson"
    }
}

// MARK: - Kind anlegen

/// Legt ein Kind ohne eigenen Zugang an und verknüpft es direkt mit der
/// eingeloggten Person. Bei Erfolg reicht das Sheet das `ChildCreated` nach
/// oben (die View ergänzt die Liste lokal) und schließt sich.
struct FamilyCreateChildSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: (ChildCreated) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var hasBirthDate = false
    @State private var birthDate = Date()
    @State private var relation: ChildCreateRelation = .parent
    @State private var saving = false
    @State private var errorMessage: String?

    private var canSubmit: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
            && !saving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $firstName) { Text(verbatim: "Vorname") }
                    TextField(text: $lastName) { Text(verbatim: "Nachname") }
                } header: {
                    Text(verbatim: "Kind")
                } footer: {
                    Text(verbatim: "Legt ein neues Mitglied ohne eigenen Zugang an und verknüpft es direkt mit dir.")
                }

                Section {
                    Toggle(isOn: $hasBirthDate) { Text(verbatim: "Geburtsdatum angeben") }
                    if hasBirthDate {
                        DatePicker(selection: $birthDate, displayedComponents: .date) {
                            Text(verbatim: "Geburtsdatum")
                        }
                    }
                } footer: {
                    Text(verbatim: "Optional — hilft bei der Zuordnung zur Altersklasse.")
                }

                Section {
                    Picker(selection: $relation) {
                        ForEach(ChildCreateRelation.allCases, id: \.self) { r in
                            Text(verbatim: familyRelationLabel(r.rawValue)).tag(r)
                        }
                    } label: {
                        Text(verbatim: "Verhältnis")
                    }
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: "Kind anlegen"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        submit()
                    } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen"))
                    }
                    .disabled(!canSubmit)
                }
            }
        }
    }

    private func submit() {
        guard canSubmit else { return }
        saving = true
        errorMessage = nil
        let body = ChildCreate(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            birthDate: hasBirthDate ? QuickCreateFormat.date(birthDate) : nil,
            relation: relation
        )
        _Concurrency.Task {
            do {
                let created = try await api.createChild(clubId: clubId, body)
                onCreated(created)
                dismiss()
            } catch {
                errorMessage = familyErrorText(error)
            }
            saving = false
        }
    }
}

// MARK: - Kind verknüpfen

/// Verknüpft ein bestehendes, vereinsverwaltetes Mitglied (ohne eigenen Zugang)
/// als eigenes Kind. Durchsuchbarer Picker über die von der View vorgefilterten
/// Kandidaten; der Server erzwingt die Regel endgültig. Bei Erfolg reicht das
/// Sheet die neue Kante + das Mitglied nach oben.
struct FamilyLinkChildSheet: View {
    let api: APIClient
    let clubId: String
    let candidates: [ClubMember]
    let onLinked: (Guardianship, ClubMember) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selectedId: String?
    @State private var relation: GuardianshipCreateRelation = .parent
    @State private var saving = false
    @State private var errorMessage: String?

    private var filtered: [ClubMember] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return candidates }
        return candidates.filter { $0.familyFullName.lowercased().contains(needle) }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $relation) {
                        ForEach(GuardianshipCreateRelation.allCases, id: \.self) { r in
                            Text(verbatim: familyRelationLabel(r.rawValue)).tag(r)
                        }
                    } label: {
                        Text(verbatim: "Verhältnis")
                    }
                } footer: {
                    Text(verbatim: "Verknüpfe ein bestehendes, vereinsverwaltetes Mitglied ohne eigenen Zugang als dein Kind.")
                }

                if candidates.isEmpty {
                    Section {
                        Text(verbatim: "Keine verknüpfbaren Mitglieder gefunden. Es lassen sich nur vereinsverwaltete Mitglieder ohne eigenen Zugang verknüpfen.")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                } else {
                    Section {
                        TextField(text: $query) { Text(verbatim: "Name eingeben …") }
#if os(iOS)
                            .textInputAutocapitalization(.words)
#endif
                    } header: {
                        Text(verbatim: "Mitglied suchen")
                    }

                    Section {
                        if filtered.isEmpty {
                            Text(verbatim: "Kein Mitglied passt zur Suche.")
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        } else {
                            ForEach(filtered, id: \.id) { member in
                                Button {
                                    selectedId = member.id
                                } label: {
                                    HStack(spacing: Theme.Spacing.s3) {
                                        RSMAvatarView(name: member.familyFullName, personId: member.id, size: 36)
                                        Text(verbatim: member.familyFullName)
                                            .font(Theme.Fonts.body)
                                            .foregroundStyle(Theme.Colors.inkPrimary)
                                            .lineLimit(1)
                                        Spacer(minLength: 0)
                                        if member.id == selectedId {
                                            Image(systemName: "checkmark")
                                                .foregroundStyle(Theme.Colors.brand)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: "Kind verknüpfen"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        submit()
                    } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Verknüpfen"))
                    }
                    .disabled(selectedId == nil || saving)
                }
            }
        }
    }

    private func submit() {
        guard let id = selectedId, !saving,
              let member = candidates.first(where: { $0.id == id }) else { return }
        saving = true
        errorMessage = nil
        let body = GuardianshipCreate(childMemberId: id, relation: relation)
        _Concurrency.Task {
            do {
                let guardianship = try await api.createGuardianship(clubId: clubId, body)
                onLinked(guardianship, member)
                dismiss()
            } catch {
                errorMessage = familyErrorText(error)
            }
            saving = false
        }
    }
}
