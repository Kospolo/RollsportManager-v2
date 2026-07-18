import SwiftUI

/// Waveform aus den media_asset-Peaks (Signature-Komponente, §3.8):
/// Honig = Musik — gespielter Teil `honey`, ungespielter `waveOff`,
/// Playhead in Tinte, A–B-Region mit beschrifteten Griffen, 3-2-1 mittig.
/// Tippen/Ziehen springt; VoiceOver bedient sie als justierbaren Regler
/// mit Wertansage („1:04 von 2:30“).
struct RoutineWaveformView: View {
    let peaks: [Double]
    let durationMs: Double
    let posMs: Double
    let loopAMs: Double
    let loopBMs: Double
    let loopOn: Bool
    /// Sekunden bis zum Start — rendert das visuelle 3-2-1 über der Waveform.
    let countdownLeft: Int?
    let onSeek: (Double) -> Void

    private static let height: CGFloat = 132

    private var fraction: Double {
        durationMs > 0 ? min(1, max(0, posMs / durationMs)) : 0
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                bars
                loopRegion(width: geo.size.width)
                playhead(width: geo.size.width)
                if let countdownLeft {
                    countdownBadge(countdownLeft, size: geo.size)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard durationMs > 0, geo.size.width > 0 else { return }
                        let ratio = min(1, max(0, value.location.x / geo.size.width))
                        onSeek(ratio * durationMs)
                    }
            )
        }
        .frame(height: Self.height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("routines.player.a11y.wave"))
        .accessibilityValue(
            Text("routines.player.wave.value \(RoutineFormat.mmss(posMs)) \(RoutineFormat.mmss(durationMs))")
        )
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSeek(min(durationMs, posMs + RoutinePlaybackEngine.skipMs))
            case .decrement: onSeek(max(0, posMs - RoutinePlaybackEngine.skipMs))
            @unknown default: break
            }
        }
    }

    // MARK: - Balken (Canvas)

    private var bars: some View {
        Canvas { context, size in
            guard !peaks.isEmpty else { return }
            let gap = size.width / CGFloat(peaks.count)
            let barWidth = gap * 0.62
            let playedUntil = Int(Double(peaks.count) * fraction)
            for (index, peak) in peaks.enumerated() {
                let height = max(0.09, min(1, peak)) * (size.height - 18)
                let rect = CGRect(
                    x: CGFloat(index) * gap + (gap - barWidth) / 2,
                    y: (size.height - height) / 2,
                    width: barWidth,
                    height: height
                )
                let path = Path(roundedRect: rect, cornerRadius: barWidth / 2)
                context.fill(
                    path,
                    with: .color(index <= playedUntil ? Theme.Colors.honey : Theme.Colors.waveOff)
                )
            }
        }
        .accessibilityHidden(true)
    }

    // MARK: - A–B-Loop-Region

    private func loopRegion(width: CGFloat) -> some View {
        let left = durationMs > 0 ? CGFloat(loopAMs / durationMs) * width : 0
        let regionWidth = durationMs > 0
            ? CGFloat(max(0, loopBMs - loopAMs) / durationMs) * width
            : 0
        return RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Theme.Colors.honey.opacity(0.15))
            .overlay(alignment: .leading) {
                Rectangle().fill(Theme.Colors.honeyDeep).frame(width: 2.5)
            }
            .overlay(alignment: .trailing) {
                Rectangle().fill(Theme.Colors.honeyDeep).frame(width: 2.5)
            }
            .overlay(alignment: .topLeading) { handleLabel("A").offset(x: -9, y: -11) }
            .overlay(alignment: .topTrailing) { handleLabel("B").offset(x: 9, y: -11) }
            .frame(width: max(regionWidth, 6), height: Self.height + 16)
            .offset(x: left, y: -8)
            .opacity(loopOn ? 1 : 0.3)
            .animation(.easeOut(duration: Theme.Motion.fast), value: loopOn)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func handleLabel(_ letter: String) -> some View {
        Text(verbatim: letter)
            .font(Theme.Fonts.monoCaption.weight(.heavy))
            .foregroundStyle(Theme.Colors.bgSurface)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(Theme.Colors.honeyDeep)
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
    }

    // MARK: - Playhead

    private func playhead(width: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Theme.Colors.inkPrimary)
            .frame(width: 2.5, height: Self.height + 16)
            .overlay(alignment: .top) {
                Circle()
                    .fill(Theme.Colors.inkPrimary)
                    .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2.5))
                    .frame(width: 11, height: 11)
                    .offset(y: -5)
            }
            .offset(x: CGFloat(fraction) * width - 1.25, y: -8)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    // MARK: - Countdown 3-2-1 (visuell — die Zeitzeile spricht den Countdown)

    private func countdownBadge(_ seconds: Int, size: CGSize) -> some View {
        Text(verbatim: "\(seconds)")
            // BEWUSST feste Groesse: die Zahl sitzt in einem 64-pt-Kreis ueber der
            // Waveform. Sie haengt an dieser Geometrie, nicht an der Textgroesse —
            // mitwachsen liesse sie aus dem Kreis laufen (wie Avatar-Initialen).
            .font(Theme.Fonts.display(size: 34))
            .monospacedDigit()
            .foregroundStyle(Theme.Colors.honeyDeep)
            .frame(width: 64, height: 64)
            .background(Circle().fill(Theme.Colors.bgSurface.opacity(0.9)))
            .overlay(Circle().stroke(Theme.Colors.line, lineWidth: 1))
            .shadow(
                color: Theme.Shadows.pop.color,
                radius: Theme.Shadows.pop.radius,
                x: Theme.Shadows.pop.x,
                y: Theme.Shadows.pop.y
            )
            .position(x: size.width / 2, y: size.height / 2)
            .accessibilityHidden(true)
    }
}
