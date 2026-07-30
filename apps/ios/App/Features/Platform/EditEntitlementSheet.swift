import SwiftUI

/// Lizenz eines Vereins setzen/ändern — Spiegel von EditEntitlementModal.tsx.
///
/// Schreibt über `patchPlatformEntitlement(clubId:_:)` → PATCH
/// /platform/entitlements/{clubId}. Der Server ist die Wahrheit: 409 (illegaler
/// Übergang), 422 (unbekanntes Produkt) und 403 (keine Berechtigung) kommen als
/// Klartext zurück.
///
/// ### `reason` ist Pflicht, nicht Deko ###
/// Jede Änderung schaltet einem FREMDEN Verein Funktionen um und landet mit
/// Begründung im operator_audit_log. Deshalb ist „Speichern" gesperrt, solange
/// das Begründungsfeld leer ist — genau wie im Web.
struct EditEntitlementSheet: View {
    /// Die zu bearbeitende Lizenzzeile (liefert `clubId`, `clubName`, Ausgangswerte).
    let row: PlatformEntitlementRow
    /// Nach erfolgreichem Speichern: Liste neu laden.
    let onSaved: () -> Void

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var tier: PlatformTier
    @State private var status: PlatformEntitlementStatus
    @State private var hasEndDate: Bool
    @State private var endDate: Date
    @State private var trialDays: String = ""
    @State private var reason: String = ""
    @State private var saving = false
    @State private var errorMessage: String?

    init(row: PlatformEntitlementRow, onSaved: @escaping () -> Void) {
        self.row = row
        self.onSaved = onSaved
        _tier = State(initialValue: Self.parseTier(row.tier))
        _status = State(initialValue: Self.parseStatus(row.status))
        let parsed = Self.parseDate(row.validUntil)
        _hasEndDate = State(initialValue: parsed != nil)
        _endDate = State(initialValue: parsed ?? Date().addingTimeInterval(60 * 60 * 24 * 365))
    }

    private var showTrialDays: Bool { status == .trial }
    private var reasonTrimmed: String {
        reason.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private var canSave: Bool { !reasonTrimmed.isEmpty && !saving }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("platform.licenses.edit.tier", selection: $tier) {
                        Text("platform.licenses.edit.tier.basic").tag(PlatformTier.basic)
                        Text("platform.licenses.edit.tier.pro").tag(PlatformTier.pro)
                        Text("platform.licenses.edit.tier.premium").tag(PlatformTier.premium)
                    }
                    Picker("platform.licenses.edit.status", selection: $status) {
                        Text("platform.licenses.edit.status.trial").tag(PlatformEntitlementStatus.trial)
                        Text("platform.licenses.edit.status.active").tag(PlatformEntitlementStatus.active)
                        Text("platform.licenses.edit.status.pastDue").tag(PlatformEntitlementStatus.pastDue)
                        Text("platform.licenses.edit.status.canceled").tag(PlatformEntitlementStatus.canceled)
                    }
                }

                if showTrialDays {
                    Section {
                        TextField("platform.licenses.edit.trialDays", text: $trialDays)
                            .keyboardType(.numberPad)
                    } footer: {
                        Text("platform.licenses.edit.trialDays.hint")
                    }
                }

                Section {
                    Toggle("platform.licenses.edit.hasEndDate", isOn: $hasEndDate.animation())
                    if hasEndDate {
                        DatePicker(
                            "platform.licenses.edit.validUntil",
                            selection: $endDate,
                            displayedComponents: .date
                        )
                    }
                } footer: {
                    Text("platform.licenses.edit.validUntil.hint")
                }

                Section {
                    TextField(
                        "platform.licenses.edit.reason",
                        text: $reason,
                        axis: .vertical
                    )
                    .lineLimit(2...4)
                } header: {
                    Text("platform.licenses.edit.reason")
                } footer: {
                    Text("platform.licenses.edit.reason.hint")
                }

                if let errorMessage {
                    Section {
                        Label {
                            Text(verbatim: errorMessage)
                                .foregroundStyle(Theme.Colors.danger)
                        } icon: {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(Theme.Colors.danger)
                        }
                        .font(Theme.Fonts.caption)
                    }
                }
            }
            .navigationTitle(Text("platform.licenses.edit.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("platform.licenses.edit.cancel") { dismiss() }
                        .disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "platform.licenses.edit.saving" : "platform.licenses.edit.save") {
                        _Concurrency.Task { await save() }
                    }
                    .disabled(!canSave)
                }
            }
            .safeAreaInset(edge: .bottom) {
                Text("platform.licenses.edit.audit")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.s3)
                    .background(.ultraThinMaterial)
            }
        }
    }

    private func save() async {
        guard canSave else { return }
        saving = true
        errorMessage = nil
        defer { saving = false }

        var patch = PlatformEntitlementPatch(tier: tier, status: status)
        patch.reason = reasonTrimmed
        // Testtage haben Vorrang, aber nur im Trial-Status. Sonst „Gültig bis"
        // (oder unbefristet = nil). Spiegel EditEntitlementModal.submit().
        if showTrialDays, let days = Int(trialDays.trimmingCharacters(in: .whitespaces)), days >= 1 {
            patch.trialDays = days
        } else if hasEndDate {
            patch.validUntil = Self.isoEndOfDay(endDate)
        } else {
            patch.validUntil = nil
        }

        do {
            _ = try await session.api.patchPlatformEntitlement(clubId: row.clubId, patch)
            onSaved()
            dismiss()
        } catch {
            if error.isForbiddenAPIError {
                errorMessage = String(localized: "platform.licenses.edit.forbidden")
            } else {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    // MARK: - Parsing / Formatierung

    private static func parseTier(_ raw: String?) -> PlatformTier {
        guard let raw, let tier = PlatformTier(rawValue: raw.lowercased()) else { return .basic }
        return tier
    }

    private static func parseStatus(_ raw: String?) -> PlatformEntitlementStatus {
        guard let raw, let status = PlatformEntitlementStatus(rawValue: raw.lowercased()) else {
            return .trial
        }
        return status
    }

    private static let isoParsers: [ISO8601DateFormatter] = {
        let frac = ISO8601DateFormatter()
        frac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return [frac, ISO8601DateFormatter()]
    }()

    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        for parser in isoParsers { if let d = parser.date(from: raw) { return d } }
        return nil
    }

    /// yyyy-MM-dd des gewählten Tages → ISO am Tagesende (UTC), damit „gültig bis"
    /// den ganzen Tag deckt (Spiegel dateInputToIso in EditEntitlementModal).
    private static func isoEndOfDay(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02dT23:59:59Z",
            c.year ?? 1970, c.month ?? 1, c.day ?? 1
        )
    }
}
