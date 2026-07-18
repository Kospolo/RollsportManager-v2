import SwiftUI
import CoreImage.CIFilterBuiltins

/// „Mein QR-Code": der scanbare Check-in-Code des eingeloggten Mitglieds zum
/// Vorzeigen an der Station, darunter die Mitglieds-ID im Klartext als Fallback
/// für die manuelle Eingabe.
///
/// Der QR wird nativ mit CoreImage (`CIQRCodeGenerator`, Apple-Framework, keine
/// Drittabhängigkeit) erzeugt. Die Nutzlast ist identisch zum Web-Vertrag
/// `RSM|member|<clubId>|<memberId>` (lib/member-qr.ts), damit derselbe Scanner
/// ihn liest. Er bleibt dunkel-auf-hell (eigener weißer Grund) — auch im Dark
/// Mode, sonst wird er unscannbar.
struct CheckinQrCard: View {
    let clubId: String
    let memberId: String
    let displayName: String

    @State private var showFullscreen = false

    /// Web-Vertrag `RSM|member|<clubId>|<memberId>` (lib/member-qr.ts).
    private var payload: String { "RSM|member|\(clubId)|\(memberId)" }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            CheckinSectionHeader(title: "checkin.qr.title", subtitle: "checkin.qr.sub")
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    qrPlate(size: 196)
                        .onTapGesture { showFullscreen = true }
                        .accessibilityElement()
                        .accessibilityLabel(Text("checkin.qr.a11y \(displayName)"))
                        .accessibilityAddTraits(.isButton)

                    identityBlock
                    hint
                    fullscreenButton
                }
                .frame(maxWidth: .infinity)
            }
        }
        .fullScreenCover(isPresented: $showFullscreen) {
            CheckinQrFullscreen(payload: payload, displayName: displayName, memberId: memberId)
        }
    }

    private var identityBlock: some View {
        VStack(spacing: Theme.Spacing.s1) {
            Text(verbatim: displayName)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .multilineTextAlignment(.center)
            HStack(spacing: Theme.Spacing.s1) {
                Text("checkin.qr.idLabel")
                Text(verbatim: memberId)
                    .font(Theme.Fonts.monoCaption)
            }
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
        }
    }

    private var hint: some View {
        Text("checkin.qr.hint")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 280)
    }

    private var fullscreenButton: some View {
        Button { showFullscreen = true } label: {
            Label("checkin.qr.fullscreen", systemImage: "arrow.up.left.and.arrow.down.right")
                .font(Theme.Fonts.caption.weight(.semibold))
        }
        .tint(Theme.Colors.brandInk)
    }

    /// QR auf weißem Grund (Kontrast/Scanbarkeit unabhängig vom App-Theme).
    private func qrPlate(size: CGFloat) -> some View {
        Group {
            if let image = CheckinQrCode.image(from: payload) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size, height: size)
            } else {
                VStack(spacing: Theme.Spacing.s2) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 40))
                    Text("checkin.qr.unavailable")
                        .font(Theme.Fonts.caption)
                }
                .foregroundStyle(Color.black.opacity(0.5))
                .frame(width: size, height: size)
            }
        }
        .padding(Theme.Spacing.s4)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
    }
}

/// CoreImage-QR-Erzeugung (Fehlerkorrektur „M"), gekapselt für Karte + Großansicht.
enum CheckinQrCode {
    static func image(from string: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        // Hochskalieren, damit die Module scharf und scanbar bleiben.
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

/// Großansicht des QR-Codes (Web-Pendant: /mein-qr) — großflächig zum Vorzeigen,
/// bewusst immer heller Grund für die Kamera der Station.
private struct CheckinQrFullscreen: View {
    let payload: String
    let displayName: String
    let memberId: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            VStack(spacing: Theme.Spacing.s6) {
                if let image = CheckinQrCode.image(from: payload) {
                    Image(uiImage: image)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 320, maxHeight: 320)
                        .accessibilityLabel(Text("checkin.qr.a11y \(displayName)"))
                }
                VStack(spacing: Theme.Spacing.s1) {
                    Text(verbatim: displayName)
                        .font(Theme.Fonts.h2)
                        .foregroundStyle(Color.black)
                    Text(verbatim: memberId)
                        .font(Theme.Fonts.monoCaption)
                        .foregroundStyle(Color.black.opacity(0.55))
                }
            }
            .padding(Theme.Spacing.s7)
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(Color.black.opacity(0.4))
                    .padding(Theme.Spacing.s5)
            }
            .accessibilityLabel(Text("checkin.qr.fullscreen.close"))
        }
    }
}
