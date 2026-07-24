import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
#if canImport(UIKit)
import UIKit
#else
// macOS: AppKit statt UIKit. Die hier benutzten UIKit-Namen
// (UIImage/UIScreen/UIAccessibility) liefert AppMac/MacPlatformShims.swift.
import AppKit
#endif

/// QR-Code aus Apples CoreImage (`CIQRCodeGenerator`) — keine externe Bibliothek.
/// Erzeugt scharfe, nicht interpolierte Kacheln (Nearest-Neighbor-Skalierung)
/// in der aktuellen Vordergrundfarbe auf transparentem Grund. Für den
/// öffentlichen Kür-Share-Link (zum Abscannen mit dem Handy).
struct RSMQRCodeView: View {
    let value: String
    var size: CGFloat = 120

    var body: some View {
        Group {
            if let image = Self.makeQRCode(from: value, side: size * UIScreen.main.scale) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "qrcode")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(Text("share.qr.a11y"))
    }

    /// Rendert `value` als QR-`UIImage` mit Kantenlänge `side` (Pixel).
    static func makeQRCode(from value: String, side: CGFloat) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }

        let scale = max(1, side / output.extent.width)
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
