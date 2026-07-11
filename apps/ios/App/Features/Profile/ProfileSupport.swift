import SwiftUI

// ============================================================================
// Lokale Ableitungen + kleine Bausteine des Profil-Moduls (Web-Referenz:
// /(portal)/profil + /(portal)/einstellungen). Bewusst feature-lokal gehalten
// (kein Import aus dem Mitglieder-Screen), damit die Module entkoppelt bleiben.
// ============================================================================

/// Datums-/Rollen-/Status-Helfer des Profil-Moduls.
enum ProfileFormat {

    // MARK: - Datum (Contracts liefern Datumswerte als String `yyyy-MM-dd`)

    /// Parsen eines Leitungsdatums (nur die ersten 10 Zeichen) in ein `Date`
    /// im lokalen Kalender — so zeigt der DatePicker denselben Kalendertag an,
    /// den der Server gespeichert hat (kein TZ-Off-by-one).
    static func date(fromWire wire: String) -> Date? {
        let day = String(wire.prefix(10))
        let parts = day.split(separator: "-")
        guard parts.count == 3,
              let year = Int(parts[0]), let month = Int(parts[1]), let dayNum = Int(parts[2])
        else { return nil }
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = dayNum
        components.hour = 12 // Mittag → immun gegen DST-Ränder
        return Calendar.current.date(from: components)
    }

    /// `Date` → Draht-String `yyyy-MM-dd` im LOKALEN Kalender (Wert fürs
    /// `birth_date`-Feld, Format `date`). Round-trip-stabil mit `date(fromWire:)`.
    static func wireString(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Draht-Datum → lokalisiertes Kurzdatum; Unparsebares roh durchreichen.
    static func day(_ wire: String) -> String {
        guard let date = date(fromWire: wire) else { return wire }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    /// Vollständige Jahre aus einem ISO-Geburtsdatum (lokale Zeit).
    static func ageYears(fromWire wire: String, now: Date = Date()) -> Int? {
        guard let birth = date(fromWire: wire) else { return nil }
        let years = Calendar.current.dateComponents([.year], from: birth, to: now).year
        guard let years, years >= 0 else { return nil }
        return years
    }

    // MARK: - Rollen

    /// Rolle → Dictionary-Key der Rollen-Beschriftung (alle sieben Rollen).
    static func roleLabelKey(_ role: ClubRole) -> LocalizedStringKey {
        switch role {
        case .owner: return "profil.role.owner"
        case .admin: return "profil.role.admin"
        case .moderator: return "profil.role.moderator"
        case .treasurer: return "profil.role.treasurer"
        case .coach: return "profil.role.coach"
        case .member: return "profil.role.member"
        case .guestCoach: return "profil.role.guest"
        }
    }

    /// Rollen-Ton der Status-Pille im Profilkopf (Heimspiel-Palette).
    static func roleTone(_ role: ClubRole) -> RSMStatusKind {
        switch role {
        case .owner: return .brand
        case .admin, .moderator, .treasurer: return .info
        case .coach: return .success
        case .member, .guestCoach: return .neutral
        }
    }

    // MARK: - Status

    /// Status → Dictionary-Key der Status-Beschriftung.
    static func statusLabelKey(_ status: MemberStatus) -> LocalizedStringKey {
        switch status {
        case .active: return "profil.status.active"
        case .pending: return "profil.status.pending"
        case .inactive: return "profil.status.inactive"
        case .left: return "profil.status.left"
        }
    }

    /// Status-Ton des Status-Chips.
    static func statusTone(_ status: MemberStatus) -> RSMStatusKind {
        switch status {
        case .active: return .success
        case .pending: return .info
        case .inactive, .left: return .neutral
        }
    }
}

/// Validierung der Profil-Eingaben.
enum ProfileValidation {
    /// Pragmatische E-Mail-Prüfung (spiegelt die Web-Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`).
    static func isValidEmail(_ raw: String) -> Bool {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return trimmed.range(
            of: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
            options: .regularExpression
        ) != nil
    }
}

/// Segment-Umschalter (Pille auf `bgSunken`, aktives Segment auf `bgSurface`) —
/// dieselbe Optik wie die Web-`Segmented`-Komponente. Die volle „Beere“ bleibt
/// der einen Primäraktion pro Sichtbereich vorbehalten.
struct ProfileSegmented<Value: Hashable>: View {
    struct Option: Identifiable {
        let value: Value
        let label: LocalizedStringKey
        var systemImage: String?
        var id: Value { value }
    }

    let accessibilityLabel: LocalizedStringKey
    let selection: Value
    let options: [Option]
    let onSelect: (Value) -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(options) { option in
                segment(option)
            }
        }
        .padding(Theme.Spacing.s1)
        .background(Theme.Colors.bgSunken)
        .clipShape(Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text(accessibilityLabel))
    }

    private func segment(_ option: Option) -> some View {
        let isSelected = option.value == selection
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { onSelect(option.value) }
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                if let symbol = option.systemImage {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .semibold))
                        .accessibilityHidden(true)
                }
                Text(option.label)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(isSelected ? Theme.Colors.inkPrimary : Theme.Colors.inkSoft)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(isSelected ? Theme.Colors.bgSurface : .clear)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

/// Einheitliches Eingabefeld-Chrome des Profil-Formulars: Body-Schrift,
/// Mulden-Fläche, Radius M — spiegelt die Web-`Input`-Optik.
struct ProfileFieldChrome: ViewModifier {
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
