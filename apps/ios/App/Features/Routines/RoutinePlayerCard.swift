import SwiftUI

/// Trainings-Player (Signature-Komponente, DESIGN-SYSTEM §3.8):
/// Waveform + Zeitzeile + Countdown-Segment + Transport (±5 s, Play 68 pt)
/// + A–B-Loop + Tempo mit Klartext-Folge (eigene Datei: RoutinePlayerTempoControl).
/// Das große Play ist die EINE Beere dieses Sichtbereichs.
struct RoutinePlayerCard: View {
    let routine: Routine
    @ObservedObject var playback: RoutinePlaybackEngine

    private static let countdownOptions = [0, 3, 5, 8]

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header

                RoutineWaveformView(
                    peaks: routine.waveformPeaks ?? [],
                    durationMs: playback.durationMs,
                    posMs: playback.posMs,
                    loopAMs: playback.loopAMs,
                    loopBMs: playback.loopBMs,
                    loopOn: playback.loopOn,
                    countdownLeft: playback.countdownLeft,
                    onSeek: { playback.seek($0) }
                )
                .padding(.top, Theme.Spacing.s3) // Platz für die A/B-Griffe

                timeline
                transportRow

                HStack(alignment: .top, spacing: Theme.Spacing.s4) {
                    countdownControl
                    Spacer(minLength: Theme.Spacing.s2)
                    loopControl
                }

                RoutinePlayerTempoControl(playback: playback)
            }
        }
    }

    // MARK: - Kopf: Honig-Eyebrow + Loop-Chip + Demo-Hinweis

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            HStack(spacing: Theme.Spacing.s2) {
                Text("routines.player.eyebrow")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.honeyDeep)
                Spacer(minLength: Theme.Spacing.s2)
                if playback.loopOn {
                    RSMStatusPill(
                        text: "routines.player.loopChip \(RoutineFormat.mmssTenths(playback.loopAMs)) \(RoutineFormat.mmssTenths(playback.loopBMs))",
                        kind: .honey
                    )
                }
            }
            statusLine
        }
    }

    /// EHRLICHE Statuszeile statt des früheren „Demo ohne Audiodatei“:
    /// zeigt Laden / Fehler / Titel+Interpret der wirklich geladenen Datei.
    @ViewBuilder private var statusLine: some View {
        switch playback.loadState {
        case .loading:
            HStack(spacing: Theme.Spacing.s2) {
                ProgressView().controlSize(.mini)
                Text("routines.player.loading")
            }
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
        case .failed(let message):
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "exclamationmark.triangle.fill")
                Text(verbatim: message)
            }
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.danger)
        case .idle:
            Text("routines.player.noAudio")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        case .ready:
            if let title = routine.musicTitle, !title.isEmpty {
                Text(verbatim: [title, routine.musicArtist]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · "))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    // MARK: - Zeitzeile: 0:00 · aktuelle Zeit groß · Gesamtlänge

    private var timeline: some View {
        let total = RoutineFormat.mmss(playback.durationMs)
        return HStack(alignment: .firstTextBaseline) {
            Text(verbatim: "0:00")
                .font(Theme.Fonts.mono(size: 12, weight: .regular))
                .foregroundStyle(Theme.Colors.inkFaint)
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s1) {
                Group {
                    if let left = playback.countdownLeft {
                        Text("routines.player.startingIn \(left)")
                    } else {
                        Text(verbatim: RoutineFormat.mmss(playback.posMs))
                    }
                }
                .font(Theme.Fonts.mono(size: 17, weight: .bold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                Text(verbatim: "/ \(total)")
                    .font(Theme.Fonts.mono(size: 12, weight: .regular))
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            .monospacedDigit()
            Spacer()
            Text(verbatim: total)
                .font(Theme.Fonts.mono(size: 12, weight: .regular))
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .monospacedDigit()
        .accessibilityElement(children: .combine)
    }

    // MARK: - Transport: −5 s · Play (68 pt, Beere) · +5 s

    private var transportRow: some View {
        HStack(spacing: Theme.Spacing.s5) {
            skipButton(
                systemName: "gobackward.5",
                delta: -RoutinePlaybackEngine.skipMs,
                a11y: "routines.player.a11y.skipBack"
            )
            playButton
            skipButton(
                systemName: "goforward.5",
                delta: RoutinePlaybackEngine.skipMs,
                a11y: "routines.player.a11y.skipForward"
            )
        }
        .frame(maxWidth: .infinity)
    }

    private var playButton: some View {
        Button { playback.togglePlay() } label: {
            Image(systemName: playback.isActive ? "pause.fill" : "play.fill")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Theme.Colors.brandContrast)
                .offset(x: playback.isActive ? 0 : 2)
                .frame(width: Theme.Size.playButton, height: Theme.Size.playButton)
                // Ohne spielbare Datei bleibt die Beere sichtbar, aber matt —
                // sie verspricht nichts, was sie nicht halten kann.
                .background(Circle().fill(playback.canPlay
                    ? Theme.Colors.brand
                    : Theme.Colors.brand.opacity(0.35)))
                .shadow(
                    color: Theme.Shadows.pop.color,
                    radius: Theme.Shadows.pop.radius,
                    x: Theme.Shadows.pop.x,
                    y: Theme.Shadows.pop.y
                )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(!playback.canPlay)
        .accessibilityLabel(
            playback.isActive
                ? Text("routines.player.a11y.pause")
                : Text("routines.player.a11y.play")
        )
    }

    private func skipButton(
        systemName: String,
        delta: Double,
        a11y: LocalizedStringKey
    ) -> some View {
        Button { playback.skip(delta) } label: {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(width: 48, height: 48)
                .background(Circle().fill(Theme.Colors.bgSurface))
                .overlay(Circle().stroke(Theme.Colors.lineStrong, lineWidth: 1))
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(!playback.canPlay)
        .accessibilityLabel(Text(a11y))
    }

    // MARK: - Countdown-Segment (Aus / 3 s / 5 s / 8 s)

    private var countdownControl: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            sectionEyebrow("routines.player.countdown.eyebrow")
            HStack(spacing: 2) {
                ForEach(Self.countdownOptions, id: \.self) { seconds in
                    countdownButton(seconds)
                }
            }
            .padding(3)
            .background(Capsule().fill(Theme.Colors.bgSunken))
            .overlay(Capsule().stroke(Theme.Colors.line, lineWidth: 1))
        }
    }

    private func countdownButton(_ seconds: Int) -> some View {
        let active = playback.countdownSetting == seconds
        return Button { playback.countdownSetting = seconds } label: {
            Group {
                if seconds == 0 {
                    Text("routines.player.countdown.off")
                } else {
                    Text("routines.player.countdown.seconds \(seconds)")
                }
            }
            .font(Theme.Fonts.body(size: 13, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(active ? Theme.Colors.inkPrimary : Theme.Colors.inkSoft)
            .frame(minWidth: 40, minHeight: 38)
            .padding(.horizontal, Theme.Spacing.s1)
            .background(Capsule().fill(active ? Theme.Colors.bgSurface : .clear))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            seconds == 0
                ? Text("routines.player.a11y.countdownOff")
                : Text("routines.player.a11y.countdown \(seconds)")
        )
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    // MARK: - A–B-Loop: A-/B-Griffe + Toggle mit Wortlabel

    private var loopControl: some View {
        VStack(alignment: .trailing, spacing: Theme.Spacing.s2) {
            sectionEyebrow("routines.player.loop.eyebrow")
            HStack(spacing: Theme.Spacing.s2) {
                loopPointButton(
                    letter: "A",
                    valueMs: playback.loopAMs,
                    a11yPrefixA: true
                ) { playback.setLoopAAtPlayhead() }
                loopPointButton(
                    letter: "B",
                    valueMs: playback.loopBMs,
                    a11yPrefixA: false
                ) { playback.setLoopBAtPlayhead() }
                loopToggle
            }
        }
    }

    private func loopPointButton(
        letter: String,
        valueMs: Double,
        a11yPrefixA: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let time = RoutineFormat.mmssTenths(valueMs)
        return Button(action: action) {
            Text(verbatim: "\(letter) \(time)")
                .font(Theme.Fonts.mono(size: 12.5, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(minHeight: 44)
                .padding(.horizontal, Theme.Spacing.s3)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Theme.Colors.bgSunken)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Theme.Colors.line, lineWidth: 1)
                )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(
            a11yPrefixA
                ? Text("routines.player.a11y.setLoopA \(time)")
                : Text("routines.player.a11y.setLoopB \(time)")
        )
    }

    private var loopToggle: some View {
        Button { playback.toggleLoop() } label: {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: "repeat")
                    .font(.system(size: 13, weight: .bold))
                Text(playback.loopOn ? "routines.player.loop.on" : "routines.player.loop.off")
                    .font(Theme.Fonts.body(size: 13, weight: .heavy))
            }
            .foregroundStyle(playback.loopOn ? Theme.Colors.honeyDeep : Theme.Colors.inkFaint)
            .frame(minHeight: 44)
            .padding(.horizontal, Theme.Spacing.s3)
            .background(
                Capsule().fill(playback.loopOn ? Theme.Colors.honeySoft : Theme.Colors.bgSunken)
            )
            .overlay(
                Capsule().stroke(
                    playback.loopOn
                        ? Theme.Colors.honeyDeep.opacity(0.3)
                        : Theme.Colors.lineStrong,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("routines.player.a11y.loopToggle"))
        .accessibilityValue(
            playback.loopOn
                ? Text("routines.player.loop.on")
                : Text("routines.player.loop.off")
        )
        .accessibilityAddTraits(playback.loopOn ? .isSelected : [])
    }

    // MARK: - Helfer

    private func sectionEyebrow(_ key: LocalizedStringKey) -> some View {
        Text(key)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Colors.inkFaint)
    }
}
