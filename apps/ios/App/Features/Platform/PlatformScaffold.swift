import SwiftUI

// ============================================================================
// Gemeinsame Hülle aller Betreiber-Abschnitte: Zustandsführung + der ehrliche
// „nur Betreiber"-Ausgang. Jeder Abschnitt liefert nur noch seinen Inhalt.
// ============================================================================

/// Die Sperr-Karte der Betreiber-Ebene.
///
/// Sie erscheint an ZWEI Stellen und sagt beide Male dasselbe: vorab als
/// Menüführung (`PlatformGate`, wenn das Token den Claim nicht trägt) und
/// nachträglich, wenn der Server 403 antwortet. Das ist Absicht — die zweite
/// ist die verbindliche, die erste spart nur den Weg dorthin.
struct PlatformDeniedCard: View {
    var body: some View {
        RSMEmptyState(
            systemImage: "lock.fill",
            title: "platform.denied.title",
            message: "platform.denied.message"
        )
        .padding(.top, Theme.Spacing.s7)
    }
}

/// Ein Abschnitt der Konsole: lädt beim Erscheinen, zeigt Laden/Sperre/Fehler
/// selbst und reicht im Erfolgsfall den Wert an `content` durch.
struct PlatformSectionScreen<Value, Content: View>: View {
    let title: LocalizedStringKey
    @ObservedObject var model: PlatformSectionModel<Value>
    let fetch: () async throws -> Value
    /// Leerer Zustand: wird gezeigt, wenn `isEmpty` für den geladenen Wert gilt.
    var isEmpty: (Value) -> Bool = { _ in false }
    var emptyImage: String = "tray"
    var emptyTitle: LocalizedStringKey = "platform.empty.title"
    var emptyMessage: LocalizedStringKey = "platform.empty.message"
    @ViewBuilder var content: (Value) -> Content

    var body: some View {
        ScrollView {
            body(for: model.state)
                .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(title))
        .navigationBarTitleDisplayMode(.large)
        .task { await model.loadIfNeeded(fetch) }
        .refreshable { await model.load(fetch) }
    }

    @ViewBuilder
    private func body(for state: PlatformLoadState<Value>) -> some View {
        switch state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.top, Theme.Spacing.s9)
        case .forbidden:
            PlatformDeniedCard()
        case .failed(let message):
            PlatformErrorCard(message: message) {
                _Concurrency.Task { await model.load(fetch) }
            }
        case .loaded(let value):
            if isEmpty(value) {
                RSMEmptyState(
                    systemImage: emptyImage,
                    title: emptyTitle,
                    message: emptyMessage
                )
                .padding(.top, Theme.Spacing.s7)
            } else {
                content(value)
            }
        }
    }
}

/// Fehlerkarte mit Weg heraus — nie eine Sackgasse.
struct PlatformErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("platform.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                RSMSecondaryButton(title: "routines.common.retry", action: retry)
            }
        }
    }
}

/// Eine Zeile „Bezeichnung — Wert" im Betreiber-Stil: der Wert steht rechts,
/// Zahlen in Tabellenziffern, damit Spalten untereinander stehen.
///
/// Ab Accessibility-Schrift bricht die Zeile in zwei Zeilen um — nebeneinander
/// bliebe vom Wert sonst nur „12…" übrig.
struct PlatformDetailRow: View {
    let label: LocalizedStringKey
    let value: Text
    var monospaced: Bool = false

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let labelView = Text(label)
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
        let valueView = value
            .font(monospaced ? Theme.Fonts.monoCaption : Theme.Fonts.bodyStrong)
            .foregroundStyle(Theme.Colors.inkPrimary)

        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 2) {
                    labelView
                    valueView
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
                    labelView
                    Spacer(minLength: Theme.Spacing.s2)
                    valueView
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Formatierhelfer der Konsole — an EINER Stelle, damit „–" für „unbekannt"
/// überall dasselbe Zeichen ist.
enum PlatformFormat {
    /// Zahl mit Tausendertrennung der aktuellen Sprache; `nil` ⇒ Gedankenstrich.
    static func count(_ value: Int?) -> Text {
        guard let value else { return Text(verbatim: "–") }
        return Text(verbatim: value.formatted(.number.grouping(.automatic)))
    }

    /// ISO-8601-Zeitstempel als lokal abgekürztes Datum; sonst der Rohwert.
    static func day(_ raw: String?) -> Text {
        guard let raw else { return Text(verbatim: "–") }
        guard let date = isoDate(raw) else { return Text(verbatim: raw) }
        return Text(verbatim: date.formatted(date: .abbreviated, time: .omitted))
    }

    /// ISO-8601-Zeitstempel als Datum + Uhrzeit.
    static func dateTime(_ raw: String?) -> Text {
        guard let raw else { return Text(verbatim: "–") }
        guard let date = isoDate(raw) else { return Text(verbatim: raw) }
        return Text(verbatim: date.formatted(date: .abbreviated, time: .shortened))
    }

    /// Freitext oder Gedankenstrich — nie ein leeres Feld ohne Erklärung.
    static func text(_ value: String?) -> Text {
        guard let value, !value.trimmingCharacters(in: .whitespaces).isEmpty else {
            return Text(verbatim: "–")
        }
        return Text(verbatim: value)
    }

    private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    private static func isoDate(_ raw: String) -> Date? {
        fractional.date(from: raw) ?? plain.date(from: raw)
    }
}
