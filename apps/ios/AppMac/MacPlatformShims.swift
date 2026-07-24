#if os(macOS)
import SwiftUI
import AppKit

// ============================================================================
// PLATTFORM-BRÜCKE macOS — die Alternative zu ~150 verstreuten #if-Blöcken.
//
// WARUM DIESE DATEI EXISTIERT
// Die App teilt sich EINE Quellbasis (App/**) zwischen iOS und macOS. Rund 150
// der 308 Dateien benutzen Modifier, die es auf macOS schlicht nicht gibt —
// `navigationBarTitleDisplayMode`, `.topBarTrailing`, `presentationDetents`,
// `keyboardType`, … . Jede dieser Stellen mit `#if os(macOS)` zu umbauen hieße:
// jedes künftige Feature muss ZWEIMAL gedacht werden, und jeder iOS-Commit
// bricht potenziell den Mac. Stattdessen liegt die Plattform-Differenz HIER,
// an genau einer Stelle: gleichnamige Ersatz-APIs, die auf dem Mac das
// Vernünftige tun (meist: nichts, weil der Mac kein Navigations-Balken-Modell
// hat). Die Feature-Teams schreiben weiter reinen iOS-Code — er compiliert auf
// beiden Plattformen.
//
// REGEL FÜR ALLE, DIE HIER ETWAS ERGÄNZEN
// Ein Shim darf NIE Verhalten erfinden, das der Nutzer nicht sieht. Er darf
// (a) folgenlos schlucken, was auf dem Mac keine Entsprechung hat, oder
// (b) auf das echte Mac-Pendant abbilden (fullScreenCover → sheet).
// Alles, was fachlich anders aussehen MUSS, gehört in eine eigene Mac-View,
// nicht in einen stillen Shim.
// ============================================================================

// MARK: - Navigationsleiste (iOS-Konzept, auf dem Mac ohne Entsprechung)

/// Ersatz für `NavigationBarItem.TitleDisplayMode`. Der Mac kennt keinen
/// groß/klein umschaltenden Navigations-Titel — der Modus verpufft bewusst.
enum RSMNavigationBarTitleDisplayMode {
    case automatic, inline, large
}

extension View {
    /// No-op auf macOS: der Titel sitzt in der Fenster-Titelleiste.
    func navigationBarTitleDisplayMode(_ mode: RSMNavigationBarTitleDisplayMode) -> some View {
        self
    }

    /// No-op auf macOS: es gibt keinen Zurück-Knopf in einer Navigationsleiste;
    /// die Sidebar bleibt der Weg zurück.
    func navigationBarBackButtonHidden(_ hidden: Bool = true) -> some View {
        self
    }
}

extension ToolbarItemPlacement {
    /// iOS: links in der Navigationsleiste → Mac: führende Position in der
    /// Fenster-Toolbar.
    static var topBarLeading: ToolbarItemPlacement { .navigation }
    /// iOS: rechts in der Navigationsleiste → Mac: Primäraktion rechts.
    static var topBarTrailing: ToolbarItemPlacement { .primaryAction }
    /// Alte Schreibweisen aus iOS-15-Zeiten, gleiche Zuordnung.
    static var navigationBarLeading: ToolbarItemPlacement { .navigation }
    static var navigationBarTrailing: ToolbarItemPlacement { .primaryAction }
}

extension SearchFieldPlacement {
    /// Anzeige-Modus der iOS-Suchleiste unter dem Titel.
    enum RSMDrawerDisplayMode { case automatic, always }

    /// iOS schiebt das Suchfeld in eine „Schublade“ unter den Titel; auf dem
    /// Mac sitzt es in der Toolbar — `.automatic` ist dort genau richtig.
    static func navigationBarDrawer(displayMode: RSMDrawerDisplayMode) -> SearchFieldPlacement {
        .automatic
    }
}

// MARK: - Blätter (Sheets)

// `presentationDetents` und `presentationDragIndicator` stehen hier BEWUSST
// NICHT: beide gibt es auf macOS wirklich (13+). Ein Shim dafür macht die echte
// API mehrdeutig und bricht den Build. Regel für jede Ergänzung: erst prüfen,
// ob das Original auf dem Mac existiert — dann erst shimmen.

extension View {
    /// Der Mac kennt keinen Vollbild-Übergang für modale Inhalte — das
    /// ehrlichste Pendant ist das normale Blatt.
    func fullScreenCover<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss, content: content)
    }

    /// No-op auf macOS: es gibt keine Software-Tastatur, die etwas verdecken
    /// könnte.
    func scrollDismissesKeyboard(_ mode: RSMScrollDismissesKeyboardMode) -> some View { self }
}

enum RSMScrollDismissesKeyboardMode { case automatic, immediately, interactively, never }

// MARK: - Texteingabe (Software-Tastatur gibt es nur auf iOS)

/// Ersatz für `UIKeyboardType`.
enum RSMKeyboardType {
    case `default`, asciiCapable, numbersAndPunctuation, URL, numberPad,
         phonePad, namePhonePad, emailAddress, decimalPad, twitter,
         webSearch, asciiCapableNumberPad
}

/// Ersatz für `TextInputAutocapitalization`.
enum RSMTextInputAutocapitalization { case never, words, sentences, characters }

extension View {
    /// No-op auf macOS: die Hardware-Tastatur kennt keinen Typ.
    func keyboardType(_ type: RSMKeyboardType) -> some View { self }
    /// No-op auf macOS: keine Auto-Großschreibung ohne Software-Tastatur.
    func textInputAutocapitalization(_ style: RSMTextInputAutocapitalization?) -> some View { self }
}

// MARK: - UIKit-Typen, die in vier geteilten Dateien vorkommen

/// Bild-Typ der Plattform. Der Name bleibt `UIImage`, damit `MediaImage`,
/// `RSMClubLogoView`, `RSMQRCodeView` und `CheckinQrCard` unverändert bleiben.
typealias UIImage = NSImage

extension NSImage {
    /// Pendant zu `UIImage(cgImage:)` — NSImage braucht zusätzlich eine Größe;
    /// die Pixelmaße des CGImage sind hier die richtige Antwort.
    convenience init(cgImage: CGImage) {
        self.init(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }

    /// Pendant zur Eigenschaft `UIImage.cgImage`. AppKit bietet dafür nur die
    /// Methode `cgImage(forProposedRect:context:hints:)`; `MediaImage` braucht
    /// sie, um die Speicherkosten eines Bildes für den NSCache zu schätzen.
    var cgImage: CGImage? {
        cgImage(forProposedRect: nil, context: nil, hints: nil)
    }
}

extension Image {
    /// Pendant zu `Image(uiImage:)`.
    init(uiImage: NSImage) { self.init(nsImage: uiImage) }
}

/// Ersatz für `UIScreen.main.scale` (nur für die QR-Pixeldichte gebraucht).
enum UIScreen {
    struct RSMScreenMetrics {
        /// Backing-Faktor des Hauptbildschirms; 2.0 als sicherer Rückfall.
        var scale: CGFloat { NSScreen.main?.backingScaleFactor ?? 2 }
    }
    static let main = RSMScreenMetrics()
}

/// Ersatz für `UIAccessibility.isReduceMotionEnabled`.
enum UIAccessibility {
    static var isReduceMotionEnabled: Bool {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    }
}

/// Ersatz für `UIPasteboard.general.string`.
enum UIPasteboard {
    struct RSMPasteboard {
        var string: String? {
            get { NSPasteboard.general.string(forType: .string) }
            nonmutating set {
                NSPasteboard.general.clearContents()
                if let newValue { NSPasteboard.general.setString(newValue, forType: .string) }
            }
        }
    }
    static let general = RSMPasteboard()
}
#endif
