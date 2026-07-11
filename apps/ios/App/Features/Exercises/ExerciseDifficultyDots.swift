import SwiftUI

/// Schwierigkeits-Anzeige 1..5 als gefüllte/leere Punkte (Web-Referenz:
/// uebungen/_components/DifficultyDots.tsx). Rein visuell — die Bedeutung
/// liefert ein einzelnes Screenreader-Label „Schwierigkeit {n} von 5“ bzw.
/// „Ohne Angabe“, damit VoiceOver nicht fünf Punkte einzeln vorliest.
struct ExerciseDifficultyDots: View {
    /// Wert aus dem Contract (`Exercise.difficulty`, optional). `nil`/0 ⇒ leer.
    let value: Int?

    private var level: Int {
        guard let value, value > 0 else { return 0 }
        return min(5, value)
    }

    private var accessibilityText: String {
        level > 0
            ? String(localized: "uebungen.difficulty.value \(level)")
            : String(localized: "uebungen.difficulty.none")
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(1...5, id: \.self) { step in
                Circle()
                    .fill(step <= level ? Theme.Colors.brand : Theme.Colors.lineStrong)
                    .frame(width: 8, height: 8)
            }
        }
        .accessibilityElement()
        .accessibilityLabel(Text(verbatim: accessibilityText))
    }
}
