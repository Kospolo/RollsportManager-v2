import SwiftUI

/// Mahnlauf ausführen — zweistufiger Fluss (KEIN Auto-Confirm):
///   1) Vorschau via `runDunning(dryRun: true)` — zeigt, was PASSIEREN würde,
///      ohne etwas zu versenden (Vorschau-Badge). Der Server liefert die
///      verbindliche Zielstufe je Posten (`proposedStage`) und markiert
///      Eskalationen als `pending_approval`.
///   2) Anwenden via `applyDunning(...)` — Stufe 1 (Erinnerung) läuft als
///      Routine automatisch mit; Stufe ≥ 2 (Mahnung/Übergabe) NUR mit
///      ausdrücklicher Freigabe pro Posten (Toggle) UND einer Sicherheits-
///      abfrage. Der Server prüft die Freigabe zusätzlich (403 ohne
///      `approveEscalation`) — 403 ⇒ ruhiger Hinweis, kein Absturz.
///
/// Übersprungene Rechnungen (nicht mehr offen / schon höher) kommen als
/// `skipped` zurück — das ist KEIN Fehler.
struct DunningRunSheet: View {
    let api: APIClient
    let clubId: String
    let currencyCode: String
    let memberName: (String) -> String?
    /// Nach erfolgreichem Anwenden: Rechnungen + Mahnprotokoll neu laden.
    let onApplied: () -> Void

    @StateObject private var model = DunningRunModel()
    @State private var confirmApply = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    content
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("mahnungen.run.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text(model.resultMessage == nil ? "mahnungen.cancel" : "mahnungen.mail.close")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    .disabled(model.isApplying)
                }
            }
            .task { await model.loadPreview(api: api, clubId: clubId) }
        }
    }

    // MARK: - Zustände

    @ViewBuilder
    private var content: some View {
        if let message = model.resultMessage {
            successCard(message)
        } else {
            switch model.preview {
            case .running:
                loadingCard
            case .forbidden:
                noticeCard(icon: "lock.fill", kind: .info,
                           title: "mahnungen.run.error.title", message: "mahnungen.run.forbidden")
            case .error(let message):
                errorCard(message)
            case .ready:
                if model.isEmpty {
                    noticeCard(icon: "checkmark.seal.fill", kind: .success,
                               title: "mahnungen.run.empty.title", message: "mahnungen.run.empty.message")
                } else {
                    plan
                }
            }
        }
    }

    private var loadingCard: some View {
        RSMCard {
            HStack(spacing: Theme.Spacing.s3) {
                ProgressView().tint(Theme.Colors.brand)
                Text("mahnungen.run.eyebrow")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Über LocalizedStringKey-Interpolation gebaut (nicht `LocalizedStringKey("… \(x)")`).
    private var previewCountText: Text {
        model.total == 1
            ? Text("mahnungen.run.preview.one")
            : Text("mahnungen.run.preview.many \(model.total)")
    }

    private var plan: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    HStack(spacing: Theme.Spacing.s2) {
                        previewCountText
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        RSMStatusPill(text: "mahnungen.run.dryBadge", kind: .info)
                    }
                    section(
                        title: "mahnungen.run.routine.title",
                        hint: "mahnungen.run.routine.hint",
                        kind: .info,
                        actions: model.routineActions,
                        emptyKey: "mahnungen.run.routine.empty",
                        showToggle: false
                    )
                    section(
                        title: "mahnungen.run.approval.title",
                        hint: "mahnungen.run.approval.hint",
                        kind: .warn,
                        actions: model.approvalActions,
                        emptyKey: "mahnungen.run.approval.empty",
                        showToggle: true,
                        headerAccessory: model.approvalActions.isEmpty ? nil : approveAllButton
                    )
                    noteField
                }
            }
            microNote
            if let message = model.applyError { errorCard(message) }
            RSMPrimaryButton(
                title: model.isApplying ? "mahnungen.run.applying" : "mahnungen.run.apply",
                isLoading: model.isApplying
            ) {
                confirmApply = true
            }
            .disabled(!model.canApply)
            .opacity(model.canApply ? 1 : 0.5)
            .confirmationDialog(
                Text("mahnungen.run.confirm.title"),
                isPresented: $confirmApply,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) {
                    _Concurrency.Task {
                        if await model.apply(api: api, clubId: clubId) { onApplied() }
                    }
                } label: {
                    Text("mahnungen.run.confirm.cta")
                }
                Button("mahnungen.cancel", role: .cancel) {}
            } message: {
                Text("mahnungen.run.confirm.message \(model.selectedActions.count)")
            }
        }
    }

    private var approveAllButton: AnyView {
        AnyView(
            Button {
                withAnimation(.easeOut(duration: Theme.Motion.fast)) { model.approveAll() }
            } label: {
                Text("mahnungen.run.approveAll")
                    .font(Theme.Fonts.caption.weight(.bold))
                    .foregroundStyle(Theme.Colors.brandInk)
            }
            .buttonStyle(.plain)
        )
    }

    // MARK: - Sektion (Routine / Freigabe)

    private func section(
        title: LocalizedStringKey,
        hint: LocalizedStringKey,
        kind: RSMStatusKind,
        actions: [DunningAction],
        emptyKey: LocalizedStringKey,
        showToggle: Bool,
        headerAccessory: AnyView? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                RSMStatusPill(text: title, kind: kind)
                Spacer(minLength: Theme.Spacing.s2)
                headerAccessory
            }
            Text(hint)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
            if actions.isEmpty {
                Text(emptyKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.Spacing.s3)
                    .background(
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .strokeBorder(Theme.Colors.line, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    )
            } else {
                VStack(spacing: Theme.Spacing.s2) {
                    ForEach(actions, id: \.invoiceId) { action in
                        planRow(action, showToggle: showToggle)
                    }
                }
            }
        }
    }

    private func planRow(_ action: DunningAction, showToggle: Bool) -> some View {
        let name = memberName(action.memberId) ?? String(localized: "finance.member.unknown")
        return VStack(spacing: Theme.Spacing.s2) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    HStack(spacing: Theme.Spacing.s2) {
                        Text(verbatim: name)
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .lineLimit(1)
                        Text(verbatim: action.number)
                            .font(Theme.Fonts.monoTable)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                    Text(targetLabel(for: action.proposedStage))
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                Spacer(minLength: Theme.Spacing.s2)
                Text(verbatim: FinanceFormat.amount(cents: action.amountCents, currency: currencyCode))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            if showToggle {
                Toggle(isOn: Binding(
                    get: { model.approved.contains(action.invoiceId) },
                    set: { model.setApproved(action.invoiceId, $0) }
                )) {
                    (model.approved.contains(action.invoiceId)
                         ? Text("mahnungen.run.approve.on")
                         : Text("mahnungen.run.approve.off"))
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .tint(Theme.Colors.brand)
                .accessibilityLabel(Text("mahnungen.a11y.approveOne \(name)"))
            }
        }
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    private func targetLabel(for stage: Int) -> LocalizedStringKey {
        switch stage {
        case ..<2: "mahnungen.target.reminder"
        case 2: "mahnungen.target.dunning1"
        case 3: "mahnungen.target.dunning2"
        default: "mahnungen.target.handover"
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("mahnungen.run.note.label")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            TextField("mahnungen.run.note.placeholder", text: $model.note, axis: .vertical)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(2...4)
                .padding(Theme.Spacing.s3)
                .background(Theme.Colors.bgSunken)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    private var microNote: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.info)
                .accessibilityHidden(true)
            Text("mahnungen.run.micro")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Karten-Bausteine

    private func successCard(_ message: String) -> some View {
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(Theme.Colors.success)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text("mahnungen.run.done.title")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.success)
                    Text(verbatim: message)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }

    private func noticeCard(icon: String, kind: RSMStatusKind, title: LocalizedStringKey, message: LocalizedStringKey) -> some View {
        RSMCard {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: icon)
                    .foregroundStyle(kind.foreground)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(title)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(kind.foreground)
                    Text(message)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }

    private func errorCard(_ message: String) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        Text("mahnungen.run.error.title")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.danger)
                        Text(verbatim: message)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
                RSMSecondaryButton(title: "mahnungen.retry") {
                    _Concurrency.Task { await model.loadPreview(api: api, clubId: clubId) }
                }
            }
        }
    }
}
