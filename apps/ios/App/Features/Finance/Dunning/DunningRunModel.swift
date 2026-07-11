import Foundation

/// Zustand des Mahnlaufs (Vorschau → Anwenden), getrennt vom Screen-VM, damit
/// jedes Öffnen des Sheets frisch startet (Freigaben/Notiz leer). Alle Rechte
/// bleiben serverseitig: ein 403 wird als ruhiger Hinweis gemappt, nicht als
/// Absturz.
@MainActor
final class DunningRunModel: ObservableObject {

    enum PreviewState: Equatable {
        case running
        case forbidden
        case error(String)
        case ready
    }

    @Published private(set) var preview: PreviewState = .running
    @Published private(set) var result: DunningRunResult?
    /// Ausdrücklich freigegebene Eskalationen (Stufe ≥ 2), je invoice_id.
    @Published var approved: Set<String> = []
    @Published var note: String = ""
    @Published private(set) var isApplying = false
    /// Fehler beim scharfen Anwenden (Banner im Sheet, Vorschau bleibt stehen).
    @Published private(set) var applyError: String?
    /// Erfolgs-Zusammenfassung nach dem Anwenden (Sheet zeigt Fertig-Karte).
    @Published private(set) var resultMessage: String?

    /// Stufe 1 (Erinnerung) — läuft als Routine automatisch mit.
    var routineActions: [DunningAction] {
        result?.actions.filter { $0.action == .auto } ?? []
    }

    /// Stufe ≥ 2 (Mahnung/Übergabe) — nur mit ausdrücklicher Freigabe.
    var approvalActions: [DunningAction] {
        result?.actions.filter { $0.action == .pendingApproval } ?? []
    }

    /// Geprüfte, handlungsrelevante Posten (ohne die „keine Aktion"-Fälle).
    var total: Int { routineActions.count + approvalActions.count }

    var isEmpty: Bool { total == 0 }

    /// Was scharf geschrieben würde: Routine immer + freigegebene Eskalationen.
    var selectedActions: [DunningAction] {
        routineActions + approvalActions.filter { approved.contains($0.invoiceId) }
    }

    var canApply: Bool {
        preview == .ready && resultMessage == nil && !selectedActions.isEmpty && !isApplying
    }

    // MARK: - Vorschau (Trockenlauf)

    func loadPreview(api: APIClient, clubId: String) async {
        preview = .running
        applyError = nil
        do {
            result = try await api.runDunning(clubId: clubId, dryRun: true)
            preview = .ready
        } catch {
            if error.isForbiddenAPIError {
                preview = .forbidden
            } else {
                preview = .error((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    func setApproved(_ invoiceId: String, _ isOn: Bool) {
        if isOn { approved.insert(invoiceId) } else { approved.remove(invoiceId) }
    }

    func approveAll() {
        approved = Set(approvalActions.map(\.invoiceId))
    }

    // MARK: - Anwenden (scharf)

    /// Gruppiert die Auswahl nach Zielstufe (`applyDunning` nimmt je Aufruf eine
    /// `to_stage`) und schreibt sie. Stufe ≥ 2 geht nur mit `approveEscalation`.
    /// Rückgabe `true` ⇒ erfolgreich (Aufrufer lädt neu). GoBD: kein Löschen —
    /// nur Fortschreiben, das Protokoll wächst append-only.
    func apply(api: APIClient, clubId: String) async -> Bool {
        guard !isApplying, !selectedActions.isEmpty else { return false }
        isApplying = true
        applyError = nil
        defer { isApplying = false }

        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let noteValue = trimmed.isEmpty ? nil : trimmed
        let groups = Dictionary(grouping: selectedActions, by: { $0.proposedStage })

        var applied = 0
        var skipped = 0
        do {
            for stage in groups.keys.sorted() {
                let ids = (groups[stage] ?? []).map(\.invoiceId)
                let request = DunningApplyRequest(
                    invoiceIds: ids,
                    toStage: stage,
                    approveEscalation: stage >= 2,
                    note: noteValue
                )
                let outcome = try await api.applyDunning(clubId: clubId, request)
                applied += outcome.applied
                skipped += outcome.skipped.count
            }
            resultMessage = summary(applied: applied, skipped: skipped)
            return true
        } catch {
            applyError = error.isForbiddenAPIError
                ? String(localized: "mahnungen.forbidden.toast")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }

    private func summary(applied: Int, skipped: Int) -> String {
        let base: String
        switch applied {
        case 0: base = String(localized: "mahnungen.result.none")
        case 1: base = String(localized: "mahnungen.result.applied.one")
        default: base = String(format: NSLocalizedString("mahnungen.result.applied.many %lld", comment: ""), applied)
        }
        guard skipped > 0 else { return base }
        let skippedText = String(format: NSLocalizedString("mahnungen.result.skipped %lld", comment: ""), skipped)
        return "\(base) \(skippedText)"
    }
}
