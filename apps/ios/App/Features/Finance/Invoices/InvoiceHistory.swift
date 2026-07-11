import SwiftUI

/// Ein Verlaufseintrag einer Rechnung: ausgestellt → Erinnerungen/Mahnungen
/// (aus dem Mahnprotokoll) → bezahlt/storniert. Rein aus Contracts abgeleitet.
struct InvoiceHistoryItem: Identifiable {
    let id: String
    let kind: Kind
    let note: String?
    /// Roher Datums-/Zeitstring von der Leitung (für Sortierung + Anzeige).
    let dateIso: String?

    enum Kind {
        case issued
        case reminder(Int)
        case dunning(Int)
        case handover(Int)
        case paid(via: String?)
        case cancelled
    }
}

/// Baut den Rechnungs-Verlauf aus der Rechnung + ihrem Mahnprotokoll und liefert
/// die passende (lokalisierte) Beschriftung je Eintrag.
/// Web-Referenz: InvoiceDetailSheet.tsx `history`.
enum InvoiceHistory {

    static func build(invoice: Invoice, log: [DunningLogEntry]) -> [InvoiceHistoryItem] {
        var items: [InvoiceHistoryItem] = [
            InvoiceHistoryItem(id: "issued", kind: .issued, note: nil, dateIso: invoice.issuedOn)
        ]
        for entry in log {
            // Fallback-Stufe, falls `to_stage` fehlt: Erinnerung=1, Übergabe=4,
            // sonst 1. Mahnung=2 (deckt den Contract-Optional-Fall ab).
            let stage = entry.toStage
                ?? (entry.action == .reminder ? 1 : entry.action == .handover ? 4 : 2)
            let kind: InvoiceHistoryItem.Kind
            switch entry.action {
            case .reminder: kind = .reminder(stage)
            case .handover: kind = .handover(stage)
            case .dunning: kind = .dunning(stage)
            }
            items.append(InvoiceHistoryItem(
                id: entry.id,
                kind: kind,
                note: entry.note,
                dateIso: String(entry.createdAt.prefix(10))
            ))
        }
        if invoice.status == .paid {
            items.append(InvoiceHistoryItem(
                id: "paid", kind: .paid(via: invoice.paidVia), note: nil, dateIso: invoice.paidAt
            ))
        }
        if invoice.status == .cancelled {
            items.append(InvoiceHistoryItem(
                id: "cancelled", kind: .cancelled, note: nil, dateIso: nil
            ))
        }
        // Chronologisch; ohne Datum (z. B. Storno) ans Ende.
        return items.sorted { ($0.dateIso ?? "9999") < ($1.dateIso ?? "9999") }
    }

    static func label(_ kind: InvoiceHistoryItem.Kind) -> Text {
        switch kind {
        case .issued:
            Text("rechnungen.hist.issued")
        case .reminder(let stage):
            Text("rechnungen.hist.reminder \(stage)")
        case .dunning(let stage):
            Text("rechnungen.hist.dunning \(stage)")
        case .handover(let stage):
            Text("rechnungen.hist.handover \(stage)")
        case .paid(let via):
            if let via, !via.isEmpty {
                Text("rechnungen.hist.paidVia \(via)")
            } else {
                Text("rechnungen.hist.paid")
            }
        case .cancelled:
            Text("rechnungen.hist.cancelled")
        }
    }
}
