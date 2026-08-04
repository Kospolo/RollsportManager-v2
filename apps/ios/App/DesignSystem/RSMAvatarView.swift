import SwiftUI

/// Die sechs warmen Avatar-Töne (Signatur des Design-Systems).
///
/// Der Ton wird deterministisch aus der `personId` gehasht — auf jeder
/// Plattform identisch („Lina ist plum — überall“). Initialen-Farbe:
/// Weiß auf berry/coral/plum/petrol (Light), dunkle Initialen auf
/// honey/moss (Jury-Fix: Weiß unterschritt AA) und im Dark Mode überall
/// (die Token-Farben regeln das dynamisch).
enum RSMAvatarTone: Int, CaseIterable {
    case berry, coral, honey, moss, plum, petrol

    var fill: Color {
        switch self {
        case .berry: Theme.Colors.avatarBerry
        case .coral: Theme.Colors.avatarCoral
        case .honey: Theme.Colors.avatarHoney
        case .moss: Theme.Colors.avatarMoss
        case .plum: Theme.Colors.avatarPlum
        case .petrol: Theme.Colors.avatarPetrol
        }
    }

    var initialsColor: Color {
        switch self {
        case .honey, .moss: Theme.Colors.avatarOnAvatarDark
        default: Theme.Colors.avatarOnDefault
        }
    }

    /// Deterministischer Ton aus einer stabilen ID (z. B. `member_id`).
    /// FNV-1a statt `hashValue` — Swifts Hasher ist pro Prozesslauf zufällig
    /// geseedet und damit NICHT stabil.
    static func forId(_ id: String) -> RSMAvatarTone {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in id.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100000001b3
        }
        return RSMAvatarTone(rawValue: Int(hash % 6)) ?? .berry
    }
}

/// Runder Personen-Avatar mit Initialen (Personen = Kreis; Organisationen
/// bekommen stattdessen Icon-Kacheln mit `Theme.Radius.org` — kein Monogramm).
struct RSMAvatarView: View {
    let name: String
    /// Stabile ID für den Farbton (z. B. `member_id`); Fallback: Name.
    var personId: String?
    var size: CGFloat = 36
    /// Auth-gated Foto-URL ('/media/{key}') — ist eine hinterlegt, zeigt der
    /// Avatar das FOTO statt der Initialen (Initialen bleiben Fallback beim
    /// Laden/Fehlen). Nil = nur Initialen (wie bisher).
    var avatarUrl: String? = nil

    private var tone: RSMAvatarTone { .forId(personId ?? name) }

    /// Medien-Key aus '/media/{key}' — sonst nil (Initialen-Fallback).
    private var photoKey: String? {
        guard let url = avatarUrl else { return nil }
        let prefix = "/media/"
        guard url.hasPrefix(prefix) else { return nil }
        let key = String(url.dropFirst(prefix.count))
        return key.isEmpty ? nil : key
    }

    private var initials: String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first.map(String.init) ?? ""
        let last = parts.count > 1 ? parts.last?.first.map(String.init) ?? "" : ""
        return (first + last).uppercased()
    }

    var body: some View {
        ZStack {
            Circle().fill(tone.fill)
            Text(initials)
                .font(Theme.Fonts.body(size: size * 0.38, weight: .bold))
                .foregroundStyle(tone.initialsColor)
            if let photoKey {
                // Foto DECKT die Initialen, sobald es geladen ist. MediaImage
                // schickt den Bearer-Token mit (ein nacktes AsyncImage bekäme 401).
                MediaImage(key: photoKey, placeholderSystemImage: "person.fill")
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true) // der Name steht immer als Text daneben
    }
}
