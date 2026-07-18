import SwiftUI

// ============================================================================
// Feature-lokale Bausteine der Vereins-Einstellungen: JSONB-Zugriff auf das
// `settings`-Objekt, Feld-Validierung, Eingabefeld-Chrome, Benachrichtigungs-
// Zeile und die Nur-Ansicht (für Rollen ohne Schreibrecht). Bewusst entkoppelt
// gehalten (kein Import aus anderen Feature-Ordnern).
// ============================================================================

/// Typsichere Leser/Bauer für das freiformige `settings`-JSONB des Vereins.
enum ClubSettingsJSON {

    /// Verschachteltes Objekt (`contact`/`bank`/`notifications`) oder `nil`.
    static func object(_ settings: [String: JSONValue], _ key: String) -> [String: JSONValue]? {
        if case .object(let obj)? = settings[key] { return obj }
        return nil
    }

    /// String-Wert eines Feldes; fehlend/`null`/anderer Typ → leerer String.
    static func string(_ object: [String: JSONValue]?, _ key: String) -> String {
        if case .string(let value)? = object?[key] { return value }
        return ""
    }

    /// Bool-Wert eines Feldes; fehlend/anderer Typ → `default`.
    static func bool(_ object: [String: JSONValue]?, _ key: String, default fallback: Bool) -> Bool {
        if case .bool(let value)? = object?[key] { return value }
        return fallback
    }

    /// Leere Strings landen als `null` im JSONB (spiegelt die Web-Referenz).
    static func stringOrNull(_ value: String) -> JSONValue {
        value.isEmpty ? .null : .string(value)
    }
}

/// Plausibilitätsprüfungen der Vereins-Felder (1:1 zur Web-Referenz).
enum ClubFieldValidation {

    /// Alle Leerzeichen entfernen + Großschrift — kanonische IBAN-Form.
    static func normalizeIban(_ raw: String) -> String {
        raw.components(separatedBy: .whitespacesAndNewlines).joined().uppercased()
    }

    /// Pragmatische E-Mail-Prüfung (Web-Regex `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`).
    static func isValidEmail(_ raw: String) -> Bool {
        raw.range(
            of: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$",
            options: .regularExpression
        ) != nil
    }

    /// Leichte IBAN-Plausibilität (Web-Regex): 2 Buchstaben, 2 Ziffern, 11–30
    /// alphanumerische Zeichen. Erwartet die bereits normalisierte IBAN.
    static func isValidIban(_ normalized: String) -> Bool {
        normalized.range(
            of: "^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$",
            options: .regularExpression
        ) != nil
    }
}

/// Einheitliches Eingabefeld-Chrome: Body-Schrift, Mulden-Fläche, Radius M —
/// spiegelt die Web-`Input`-Optik (feature-lokal, damit die Teams entkoppelt
/// bleiben).
struct ClubFieldChrome: ViewModifier {
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

/// Beschriftetes Feld: Label · Inhalt · optionaler Feldfehler.
struct ClubFieldGroup<Content: View>: View {
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

/// Eine Benachrichtigungs-Zeile: Titel + Beschreibung links, Toggle rechts.
struct ClubNotifyRow: View {
    let title: LocalizedStringKey
    let desc: LocalizedStringKey
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(desc)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Theme.Colors.brand)
        .padding(.vertical, Theme.Spacing.s2)
    }
}

/// Nur-Ansicht für Rollen ohne Schreibrecht (spiegelt Web `ReadOnlyClub`):
/// Hinweis „Nur Ansicht" + Karte mit den aktuellen Kern-Stammdaten.
struct AdminClubReadOnlyView: View {
    let club: Club

    private var rows: [(label: LocalizedStringKey, value: String)] {
        [
            ("verein.field.name", nonEmpty(club.name)),
            ("verein.field.shortName", nonEmpty(club.shortName)),
            ("verein.field.city", nonEmpty(club.city)),
            ("verein.field.discipline", nonEmpty(club.discipline)),
        ]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                // Logo: ANZEIGEN darf jede:r (öffentliche Route) — Setzen/
                // Entfernen bleibt owner/admin vorbehalten, deshalb canEdit=false.
                AdminClubLogoCard(
                    clubId: club.id,
                    canEdit: false,
                    initialHasLogo: club.logoAssetId != nil
                )
                RSMCard {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Theme.Colors.inkFaint)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("verein.readonly.title")
                                .font(Theme.Fonts.h3)
                                .foregroundStyle(Theme.Colors.inkPrimary)
                            Text("verein.readonly.body")
                                .font(Theme.Fonts.body)
                                .foregroundStyle(Theme.Colors.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                RSMCard {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                        RSMSectionHeader(
                            eyebrow: "verein.core.eyebrow",
                            title: "verein.core.title"
                        )
                        VStack(spacing: 0) {
                            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                                HStack(alignment: .firstTextBaseline) {
                                    Text(row.label)
                                        .font(Theme.Fonts.caption.weight(.semibold))
                                        .foregroundStyle(Theme.Colors.inkFaint)
                                    Spacer(minLength: Theme.Spacing.s4)
                                    Text(verbatim: row.value)
                                        .font(Theme.Fonts.body)
                                        .foregroundStyle(Theme.Colors.inkPrimary)
                                        .multilineTextAlignment(.trailing)
                                }
                                .frame(minHeight: Theme.Size.touchTarget)
                                if index < rows.count - 1 {
                                    Divider().overlay(Theme.Colors.line)
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
    }

    private func nonEmpty(_ value: String?) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty
            ? NSLocalizedString("verein.readonly.empty", comment: "Platzhalter für leeres Feld")
            : trimmed
    }
}
