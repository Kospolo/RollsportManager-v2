import SwiftUI

/// Tempo-Bereich des Trainings-Players (DESIGN-SYSTEM §3.8, „Tempo aus B“):
/// Preset-Pills 50/75/85/100 % PLUS Feinregler 0,5–2,0× — bidirektional
/// synchron (Pill ↔ Slider ↔ Anzeige), immer mit dynamischer Klartext-Folge
/// („bei 85 % läuft die Kür 2:56 statt 2:30 · Tonhöhe bleibt erhalten“).
struct RoutinePlayerTempoControl: View {
    @ObservedObject var playback: RoutinePlaybackEngine

    private static let presets = [50, 75, 85, 100]

    private static let factorFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    private var tempoInt: Int { Int(playback.tempoPercent.rounded()) }

    private var sliderBinding: Binding<Double> {
        Binding(
            get: { playback.tempoPercent },
            set: { playback.setTempo($0) }
        )
    }

    /// "0,85×" — Faktor-Anzeige neben dem Slider.
    private var factorText: String {
        let factor = playback.tempoPercent / 100
        let number = Self.factorFormatter.string(from: NSNumber(value: factor))
            ?? String(format: "%.2f", factor)
        return "\(number)×"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Divider().overlay(Theme.Colors.line)

            Text("routines.player.tempo.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)

            HStack(spacing: Theme.Spacing.s2) {
                ForEach(Self.presets, id: \.self) { preset in
                    presetPill(preset)
                }
            }

            HStack(spacing: Theme.Spacing.s3) {
                Slider(value: sliderBinding, in: 50...200, step: 5)
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("routines.player.a11y.tempoSlider"))
                    .accessibilityValue(Text("routines.player.a11y.tempoPreset \(tempoInt)"))
                Text(verbatim: factorText)
                    .font(Theme.Fonts.mono(size: 12.5, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
            }

            plainLanguageNote
        }
    }

    // MARK: - Bausteine

    private func presetPill(_ preset: Int) -> some View {
        let active = tempoInt == preset
        return Button { playback.setTempo(Double(preset)) } label: {
            Text(verbatim: "\(preset)\u{202F}%")
                .font(Theme.Fonts.body(size: 13.5, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(active ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
                .frame(minHeight: 44)
                .padding(.horizontal, Theme.Spacing.s3)
                .background(Capsule().fill(active ? Theme.Colors.brand : Theme.Colors.bgSurface))
                .overlay(
                    Capsule().stroke(
                        active ? Theme.Colors.brand : Theme.Colors.lineStrong,
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("routines.player.a11y.tempoPreset \(preset)"))
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    /// Klartext-Folge — IMMER dynamisch aus Tempo und Kürlänge berechnet.
    private var plainLanguageNote: some View {
        Group {
            if tempoInt == 100 {
                Text("routines.player.tempo.noteOriginal \(RoutineFormat.mmss(playback.durationMs))")
            } else {
                Text("routines.player.tempo.note \(tempoInt) \(RoutineFormat.mmss(playback.durationMs * 100 / Double(tempoInt))) \(RoutineFormat.mmss(playback.durationMs))")
            }
        }
        .font(Theme.Fonts.caption)
        .monospacedDigit()
        .foregroundStyle(Theme.Colors.inkSoft)
    }
}
