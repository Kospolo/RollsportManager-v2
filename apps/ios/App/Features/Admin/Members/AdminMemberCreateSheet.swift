import SwiftUI

/// „Mitglied anlegen" (POST /clubs/{clubId}/members) — für Personen, die sich
/// NICHT selbst registrieren: v. a. ältere Ehrenamtliche ohne Handy, die der
/// Vorstand in die Verwaltung aufnimmt. Nur Vor-/Nachname sind Pflicht; ohne
/// E-Mail entsteht ein reiner Datensatz ohne Login. Rolle/weitere Angaben lassen
/// sich danach über das Bearbeiten-Sheet ändern.
///
/// Präsentiert von AdminMembersView; nur mit `can_manage_members` erreichbar
/// (Knopf dort gated, Server prüft zusätzlich).
struct AdminMemberCreateSheet: View {
    let api: APIClient
    let clubId: String
    /// Nach dem Anlegen: Liste neu laden.
    let onCreated: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var setsBirthDate = false
    @State private var birthDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date()
    @State private var saving = false
    @State private var errorMessage: String?

    private var canSave: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
            && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $firstName) { Text(verbatim: "Vorname") }
                        .textContentType(.givenName)
                    TextField(text: $lastName) { Text(verbatim: "Nachname") }
                        .textContentType(.familyName)
                } header: {
                    Text(verbatim: "Name")
                }

                Section {
                    Toggle(isOn: $setsBirthDate) { Text(verbatim: "Geburtsdatum angeben") }
                    if setsBirthDate {
                        DatePicker(selection: $birthDate, in: ...Date(), displayedComponents: .date) {
                            Text(verbatim: "Geburtsdatum")
                        }
                    }
                }

                Section {
                    TextField(text: $email) { Text(verbatim: "E-Mail (optional)") }
#if os(iOS)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
#endif
                        .autocorrectionDisabled()
                } footer: {
                    Text(verbatim: "Ohne E-Mail wird nur ein Datensatz angelegt — kein Login. Passend für Ehrenamtliche ohne Handy. Rolle und weitere Angaben lassen sich danach im Bearbeiten ändern.")
                }

                if let errorMessage {
                    Section {
                        Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger)
                    }
                }
            }
            .navigationTitle(Text(verbatim: "Mitglied anlegen"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }
                        .disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: {
                        if saving { ProgressView() } else { Text(verbatim: "Anlegen") }
                    }
                    .disabled(!canSave || saving)
                }
            }
        }
    }

    private func save() {
        guard canSave, !saving else { return }
        saving = true
        errorMessage = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        let input = ClubMemberCreate(
            firstName: firstName.trimmingCharacters(in: .whitespaces),
            lastName: lastName.trimmingCharacters(in: .whitespaces),
            email: trimmedEmail.isEmpty ? nil : trimmedEmail,
            birthDate: setsBirthDate ? AdminMemberCreateSheet.isoDate(birthDate) : nil
        )
        _Concurrency.Task {
            do {
                _ = try await api.createMember(clubId: clubId, input)
                onCreated()
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription
                    ?? error.localizedDescription
            }
            saving = false
        }
    }

    /// Date → „YYYY-MM-DD" (das date-Format des Contracts), zeitzonenstabil.
    private static func isoDate(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
}
