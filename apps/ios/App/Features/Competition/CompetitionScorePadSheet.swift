import SwiftUI

/// RollArt-Schnelleingabe als Sheet: zwei Stepper (Technik · Komponenten,
/// Schritte ∓1 / ∓0,1), Gesamt live. „Wertung übernehmen“ postet echt via
/// `saveRoutineScore` (Trainerstab; 403 → Alert, Sheet bleibt offen). Erfolg
/// schließt das Sheet und meldet die erzeugte Wertung zurück (Rangliste neu
/// laden). Web-Referenz: wettkampf/_components/ScorePad.
struct CompetitionScorePadSheet: View {
    let api: APIClient
    let competitionId: String
    let row: CompetitionStandingRow
    let onSaved: (RoutineScore) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var technical: Double
    @State private var components: Double
    @State private var isSaving = false
    @State private var submitError: String?

    init(
        api: APIClient,
        competitionId: String,
        row: CompetitionStandingRow,
        onSaved: @escaping (RoutineScore) -> Void
    ) {
        self.api = api
        self.competitionId = competitionId
        self.row = row
        self.onSaved = onSaved
        // Vorbelegt mit der letzten Wertung (falls vorhanden), sonst 0.
        _technical = State(initialValue: row.technicalScore ?? 0)
        _components = State(initialValue: row.componentsScore ?? 0)
    }

    private var total: Double { WettkampfScore.round2(technical + components) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            skaterHeader
                            WettkampfScoreStepper(
                                labelKey: "wettkampf.col.technical",
                                value: $technical,
                                disabled: isSaving
                            )
                            WettkampfScoreStepper(
                                labelKey: "wettkampf.col.components",
                                value: $components,
                                disabled: isSaving
                            )
                            totalRow
                            Text(row.totalScore != nil
                                ? "wettkampf.scorepad.hint.prefilled"
                                : "wettkampf.scorepad.hint.new")
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkFaint)
                        }
                    }
                    RSMPrimaryButton(title: "wettkampf.scorepad.submit", isLoading: isSaving) {
                        _Concurrency.Task { await submit() }
                    }
                    .disabled(total <= 0)
                    .accessibilityLabel(Text("wettkampf.scorepad.a11y.submit"))
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("wettkampf.scorepad.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("wettkampf.cancel") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
            .alert("wettkampf.error.title", isPresented: submitErrorBinding) {
                Button("wettkampf.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: submitError ?? "")
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Kopf (Starter · Kür · Kategorie)

    private var skaterHeader: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(verbatim: WettkampfStandings.skaterName(row))
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(verbatim: routineSubtitle)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var routineSubtitle: String {
        guard !row.category.isEmpty else { return row.routineTitle }
        return "\(row.routineTitle) · \(row.category)"
    }

    // MARK: - Gesamt

    private var totalRow: some View {
        HStack {
            Text("wettkampf.col.total")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Spacer()
            Text(verbatim: WettkampfScore.format(total))
                .font(Theme.Fonts.mono(size: 22, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .padding(.horizontal, Theme.Spacing.s4)
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Absenden

    @MainActor
    private func submit() async {
        guard !isSaving, total > 0 else { return }
        isSaving = true
        defer { isSaving = false }

        let input = RoutineScoreCreate(
            scoredOn: WettkampfDate.todayString(),
            scoringSystem: "rollart",
            technicalScore: WettkampfScore.round2(technical),
            componentsScore: WettkampfScore.round2(components),
            totalScore: total,
            competitionId: competitionId
        )
        do {
            let created = try await api.saveRoutineScore(routineId: row.routineId, input)
            onSaved(created)
            dismiss()
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("wettkampf.scorepad.forbidden", comment: "403 beim Werten")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    private var submitErrorBinding: Binding<Bool> {
        Binding(
            get: { submitError != nil },
            set: { if !$0 { submitError = nil } }
        )
    }
}

/// Ein RollArt-Stepper: Label über einer Mulden-Zeile mit ∓1 / ∓0,1 um den
/// aktuellen Wert (auf 0…150 begrenzt, zwei Nachkommastellen). Berührungsziele
/// 44 pt (Design-System). Web-Referenz: ScorePad → ScoreStepper.
private struct WettkampfScoreStepper: View {
    let labelKey: LocalizedStringKey
    @Binding var value: Double
    var disabled: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(labelKey)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            HStack(spacing: Theme.Spacing.s1) {
                stepButton(-1)
                stepButton(-0.1)
                Spacer(minLength: 0)
                Text(verbatim: WettkampfScore.format(value))
                    .font(Theme.Fonts.mono(size: 17, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .frame(minWidth: 70)
                Spacer(minLength: 0)
                stepButton(0.1)
                stepButton(1)
            }
        }
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    private func stepButton(_ step: Double) -> some View {
        Button {
            value = WettkampfScore.round2(min(150, max(0, value + step)))
        } label: {
            Text(verbatim: stepLabel(step))
                .font(Theme.Fonts.mono(size: 12, weight: .bold))
                .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
                .background(Theme.Colors.bgSurface)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.Colors.lineStrong, lineWidth: 1))
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(disabled)
        .accessibilityLabel(Text(verbatim: stepLabel(step)))
    }

    /// „+1“ / „−0,1“ mit echtem Minuszeichen und lokalisierter Dezimalzahl.
    private func stepLabel(_ step: Double) -> String {
        let sign = step > 0 ? "+" : "−"
        let magnitude = Swift.abs(step) == 1 ? "1" : WettkampfScore.format(0.1)
        return sign + magnitude
    }
}
