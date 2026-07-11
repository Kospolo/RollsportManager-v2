import SwiftUI

/// Geteilte Klein-Bausteine des Check-in-Moduls (Sektionskopf, Chips,
/// Rückmeldung, Auswahlfeld-Chrome). Alle über die „Heimspiel"-Tokens gestylt,
/// Dark Mode inklusive; kein hartkodierter Wert.

/// Sektionskopf: H3-Titel + Caption-Unterzeile (Web-Referenz: SectionHeader
/// level 2 mit `sub`).
struct CheckinSectionHeader: View {
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(subtitle)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Erfassungsart-Chip: QR = Info-Petrol, Manuell = neutral. Immer mit Wort
/// (Status nie nur über Farbe).
struct CheckinMethodBadge: View {
    let method: CheckinMethod

    var body: some View {
        RSMStatusPill(
            text: method == .qr ? "checkin.method.qr" : "checkin.method.manual",
            kind: method == .qr ? .info : .neutral
        )
    }
}

/// Chip mit dynamischem (nicht lokalisiertem) Text — für Termin-Titel in der
/// Liste. Gleiches Aussehen wie `RSMStatusPill`, aber `verbatim`.
struct CheckinVerbatimChip: View {
    let text: String
    var kind: RSMStatusKind = .neutral

    var body: some View {
        Text(verbatim: text)
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(kind.foreground)
            .lineLimit(1)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(kind.background)
            .clipShape(Capsule())
    }
}

/// Inline-Rückmeldung nach einer Aktion (nativer Ersatz für den Web-Toast):
/// Erfolg grün, Fehler rot — Icon + Wort, nie Farbe allein.
struct CheckinStatusLine: View {
    enum Tone { case success, danger }

    let tone: Tone
    let text: Text

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Image(systemName: tone == .success ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .accessibilityHidden(true)
            text
        }
        .font(Theme.Fonts.caption.weight(.semibold))
        .foregroundStyle(tone == .success ? Theme.Colors.success : Theme.Colors.danger)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Chrome für Menü-Auswahlen (Termin/Mitglied): Mulden-Fläche, Radius M,
/// Chevron rechts — sieht aus und trifft wie ein natives Auswahlfeld (≥ 44 pt).
struct CheckinMenuLabel: View {
    let title: String
    var isPlaceholder = false

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(verbatim: title)
                .font(Theme.Fonts.body)
                .foregroundStyle(isPlaceholder ? Theme.Colors.inkFaint : Theme.Colors.inkPrimary)
                .lineLimit(1)
            Spacer(minLength: Theme.Spacing.s2)
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}

/// Fehler → Hinweis-Text: 403 wird zur verständlichen „keine Berechtigung"-
/// Meldung, sonst die technische Beschreibung des API-Clients.
func checkinErrorText(_ error: Error) -> Text {
    error.isForbiddenAPIError
        ? Text("checkin.forbidden")
        : Text(verbatim: CheckinViewModel.friendlyMessage(error))
}
