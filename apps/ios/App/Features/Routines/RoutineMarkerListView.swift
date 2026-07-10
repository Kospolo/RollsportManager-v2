import SwiftUI

/// Zeitmarken-Liste (DESIGN-SYSTEM §3.8): Mono-Zeit-Badge in Honig,
/// Elementname + RollArt-Kürzel-Chip, Tap = „ab hier abspielen“.
/// Marker innerhalb des aktiven A–B-Loops tragen den Honig-Chip „im Loop“.
struct RoutineMarkerListView: View {
    let markers: [RoutineMarker]
    let loopOn: Bool
    let loopAMs: Double
    let loopBMs: Double
    let onJump: (Double) -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(
                    eyebrow: "routines.markers.eyebrow",
                    title: "routines.markers.title"
                )
                if markers.isEmpty {
                    Text("routines.markers.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    VStack(spacing: 2) {
                        ForEach(markers, id: \.id) { marker in
                            markerRow(marker)
                        }
                    }
                }
            }
        }
    }

    private func markerRow(_ marker: RoutineMarker) -> some View {
        let timeMs = Double(marker.timeMs ?? 0)
        let time = RoutineFormat.mmss(timeMs)
        let inLoop = loopOn && timeMs >= loopAMs && timeMs <= loopBMs

        return Button { onJump(timeMs) } label: {
            HStack(spacing: Theme.Spacing.s3) {
                Text(verbatim: time)
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.honeyDeep)
                    .padding(.horizontal, Theme.Spacing.s2)
                    .padding(.vertical, Theme.Spacing.s1)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                            .fill(Theme.Colors.honeySoft)
                    )

                HStack(spacing: Theme.Spacing.s2) {
                    Text(verbatim: marker.label)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    if let code = marker.elementCode {
                        RoutineElementChip(code: code)
                    }
                    if inLoop {
                        RSMStatusPill(text: "routines.markers.inLoop", kind: .honey)
                    }
                }

                Spacer(minLength: Theme.Spacing.s2)

                Image(systemName: "play.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .frame(width: 34, height: 34)
                    .overlay(Circle().stroke(Theme.Colors.line, lineWidth: 1))
            }
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(
            Text("routines.markers.a11y.playFrom \(time) \(marker.label)")
        )
    }
}
