import SwiftUI

/// Betreiber-Sicht „Konten": alle Nutzerkonten der Plattform.
///
/// ### WAS HIER BEWUSST NICHT STEHT ###
/// Keine E-Mail-Adresse, kein Geburtsdatum, keine Vereinszugehörigkeit im
/// Klartext, keine Beiträge. Der Contract (`PlatformUser`) liefert genau vier
/// Angaben — Anzeigename, Sprache, Zahl der Mitgliedschaften, Anlagedatum —
/// und mehr braucht der Betrieb auch nicht. Wer hier „nur schnell" die
/// E-Mail ergänzt, baut aus einer Betriebsübersicht ein Personenverzeichnis
/// über sehr viele Kinder.
///
/// Identität deshalb über Monogramm + Farbton (`RSMAvatarView`), nie über ein
/// Foto: der Member-Pfad trägt keine Einwilligungs-Wache.
struct PlatformUsersView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<[PlatformUser]>()
    @State private var search = ""

    var body: some View {
        PlatformSectionScreen(
            title: "platform.users.title",
            model: model,
            fetch: { try await session.api.listPlatformUsers() },
            isEmpty: { $0.isEmpty },
            emptyImage: "person.crop.circle",
            emptyTitle: "platform.users.empty.title",
            emptyMessage: "platform.users.empty.message"
        ) { users in
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("platform.users.count \(users.count)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .padding(.leading, Theme.Spacing.s1)

                privacyNote

                RSMCard(padding: Theme.Spacing.s2) {
                    VStack(spacing: 0) {
                        let rows = filtered(users)
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, user in
                            userRow(user)
                            if index < rows.count - 1 {
                                Divider().overlay(Theme.Colors.line)
                            }
                        }
                    }
                }

                if filtered(users).isEmpty {
                    Text("platform.search.noMatch")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .padding(.top, Theme.Spacing.s5)
                }
            }
        }
        .searchable(text: $search, prompt: Text("platform.users.search"))
    }

    /// Sagt offen, warum hier so wenig steht. Ein Betreiber, der die fehlende
    /// E-Mail für einen Fehler hält, sucht sonst nach einem Weg drumherum.
    private var privacyNote: some View {
        Label("platform.users.privacyNote", systemImage: "hand.raised.fill")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s3)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    private func filtered(_ users: [PlatformUser]) -> [PlatformUser] {
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return users }
        return users.filter { ($0.displayName ?? "").lowercased().contains(needle) }
    }

    private func userRow(_ user: PlatformUser) -> some View {
        let name = user.displayName ?? String(localized: "platform.users.unnamed")
        return HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: name, personId: user.id, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: name)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("platform.users.memberships \(user.clubCount ?? 0)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: Theme.Spacing.s2)
            // Sprachkürzel als Chip. BEWUSST `Text(verbatim:)` statt
            // `RSMStatusPill`: „de"/„en" sind Daten, keine Übersetzungsschlüssel
            // — ein LocalizedStringKey daraus würde beim nächsten gleichnamigen
            // Eintrag im Katalog stillschweigend etwas anderes anzeigen.
            Text(verbatim: user.locale.uppercased())
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, Theme.Spacing.s1)
                .background(Theme.Colors.bgSunken)
                .clipShape(Capsule())
        }
        .padding(.horizontal, Theme.Spacing.s2)
        .frame(minHeight: Theme.Size.listRow)
        .accessibilityElement(children: .combine)
    }
}
