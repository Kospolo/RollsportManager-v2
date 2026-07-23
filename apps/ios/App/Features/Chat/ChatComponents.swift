import SwiftUI

// ============================================================================
// Wiederverwendbare Chat-Bausteine: Kanalzeile (Liste) + Nachrichtenblase
// (Thread). Alle Farben/Abstände über Theme-Tokens, Dark Mode dynamisch.
// Web-Referenz: ChannelList.tsx / MessageBubble.tsx.
// ============================================================================

// MARK: - Kanalzeile

/// Eine Zeile der Kanalliste: führendes Glyph (Team-Icon bzw. Peer-Avatar),
/// Titel, Vorschau der letzten Nachricht und kompakter Zeitstempel.
struct ChatChannelRow: View {
    let channel: ChatChannel
    let currentMemberId: String
    /// Auflöser member_id → Name (für Absender in Team-Kanälen); `nil`, wenn
    /// die Mitgliederliste nicht sichtbar war.
    let nameFor: (String?) -> String?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var isAX: Bool { dynamicTypeSize.isAccessibilitySize }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            ChatChannelGlyph(channel: channel)
            VStack(alignment: .leading, spacing: 2) {
                titleAndStamp
                preview
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    // Bei AX-Schrift blieb von der Vorschau nur „Du: Perfekt,
                    // dann…" — drei Zeilen sagen tatsaechlich etwas aus.
                    .lineLimit(isAX ? 3 : 1)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.vertical, Theme.Spacing.s2)
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
    }

    /// Titel + Datum. Nebeneinander ist bei AX-Schrift nicht mehr drin: der
    /// Kanalname wurde zu „Kuergr…"/„Katrin…" gekuerzt UND das Datum brach
    /// trotzdem mitten in der Jahreszahl um („16.7.202" / „6"). Ab
    /// Accessibility-Groesse stehen beide deshalb untereinander — der Name
    /// bekommt die volle Breite, das Datum eine eigene Zeile.
    @ViewBuilder
    private var titleAndStamp: some View {
        if isAX {
            VStack(alignment: .leading, spacing: 2) {
                titleText
                stampText
            }
        } else {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                titleText
                stampText
            }
        }
    }

    private var titleText: some View {
        Text(verbatim: title)
            .font(Theme.Fonts.bodyStrong)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .lineLimit(isAX ? 2 : 1)
            // `lineLimit(2)` ALLEIN genuegt nicht: in einer horizontal
            // gedraengten HStack kuerzt SwiftUI lieber, als eine zweite Zeile
            // aufzumachen — „Kürgruppe Le…" blieb deshalb trotz Limit 2
            // einzeilig. Erst `fixedSize` in der Vertikalen sagt dem Text,
            // dass er sich die Hoehe nehmen darf, die er braucht.
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var stampText: some View {
        if let stamp = timestamp {
            Text(verbatim: stamp)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                // Ein Datum ist eine Einheit. `fixedSize` erzwingt die volle
                // Breite, damit „16.7.2026" nie zu „16.7.202" + „6" wird —
                // eine abgeschnittene Jahreszahl liest sich wie ein anderes
                // Datum, das ist schlimmer als eine breitere Zeile.
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
    }

    private var title: String {
        let name = channel.rsmDisplayName
        if !name.isEmpty { return name }
        return channel.channelType == .team
            ? String(localized: "chat.channel.team")
            : String(localized: "chat.channel.direct")
    }

    private var timestamp: String? {
        guard let last = channel.lastMessageAt else { return nil }
        let text = ChatFormat.listTimestamp(last)
        return text.isEmpty ? nil : text
    }

    /// Vorschauzeile — Web-Logik: „Du: …", „Name: …" (Team) bzw. reiner Text
    /// (Direkt), „Bild" statt Body ohne Text, sonst „Noch keine Nachrichten".
    private var preview: Text {
        guard channel.lastMessageAt != nil else {
            return Text("chat.preview.none")
        }
        let body = channel.lastBody ?? String(localized: "chat.preview.image")
        let own = channel.lastSenderMemberId == currentMemberId
        if own {
            return Text("chat.preview.you \(body)")
        }
        if channel.channelType == .team {
            let sender = nameFor(channel.lastSenderMemberId) ?? String(localized: "chat.member")
            return Text("chat.preview.other \(sender) \(body)")
        }
        return Text(verbatim: body)
    }
}

/// Führendes Glyph: Team-Kanal = getönte Icon-Kachel, Direkt-Peer = Avatar.
private struct ChatChannelGlyph: View {
    let channel: ChatChannel

    var body: some View {
        if channel.channelType == .team {
            ZStack {
                Circle().fill(Theme.Colors.infoSoft)
                Image(systemName: "person.3.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Colors.info)
            }
            .frame(width: 36, height: 36)
            .accessibilityHidden(true)
        } else {
            RSMAvatarView(
                name: channel.peerName ?? "?",
                personId: channel.peerMemberId,
                size: 36
            )
        }
    }
}

// MARK: - Nachrichtenblase

/// Eine Chat-Blase: eigene Nachrichten rechts (brand-soft), fremde links
/// (sunken). In Team-Kanälen steht der Absendername über der ersten Blase
/// einer Folge (`showSender`). Zeit steht unten in der Blase.
struct ChatMessageBubble: View {
    let message: ChatMessage
    let isOwn: Bool
    let senderName: String
    let showSender: Bool

    var body: some View {
        HStack(spacing: 0) {
            if isOwn { Spacer(minLength: Theme.Spacing.s8) }
            VStack(alignment: isOwn ? .trailing : .leading, spacing: 2) {
                if showSender {
                    Text(verbatim: senderName)
                        .font(Theme.Fonts.eyebrow)
                        .foregroundStyle(Theme.Colors.inkFaint)
                        .padding(.horizontal, Theme.Spacing.s1)
                }
                bubble
            }
            if !isOwn { Spacer(minLength: Theme.Spacing.s8) }
        }
    }

    private var bubble: some View {
        // Blase umschließt den Inhalt; die Seite steuert der Spacer außen.
        // Kein maxWidth: .infinity innen (das würde JEDE Blase auf volle
        // Breite ziehen) — Zeit richtet sich über die VStack-Ausrichtung aus.
        VStack(alignment: isOwn ? .trailing : .leading, spacing: Theme.Spacing.s1) {
            if let urlString = message.imageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Rectangle().fill(Theme.Colors.bgSunken)
                }
                .frame(maxWidth: 240, maxHeight: 240)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                .accessibilityLabel(Text("chat.image.a11y"))
            }
            if let body = message.body, !body.isEmpty {
                Text(verbatim: body)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(isOwn ? Theme.Colors.brandInk : Theme.Colors.inkPrimary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(verbatim: ChatFormat.time(message.createdAt))
                // War eingefroren auf 10,5 pt und wuchs mit Dynamic Type nicht
                // mit. Der Eyebrow-Anker (.caption2) ist die kleinste Rolle des
                // Systems; das Gewicht wird auf normal zurückgenommen, weil eine
                // Uhrzeit keine Auszeichnung ist.
                .font(Theme.Fonts.eyebrow.weight(.regular))
                .foregroundStyle(isOwn ? Theme.Colors.brandInk.opacity(0.7) : Theme.Colors.inkFaint)
                // Wie in der Kanalzeile: eine Uhrzeit bricht nicht um.
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .background(isOwn ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }
}
