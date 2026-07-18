import SwiftUI

/// Karte „Öffentliches Profil" im eigenen Profil (Web-Referenz:
/// profil/_components/SelfProfileCard.tsx): Motto („Über mich"),
/// Lieblingsdisziplin, „seit wann" — plus der Sichtbarkeits-Schalter
/// öffentlich/intern.
///
/// Der Schalter ist EHRLICH beschriftet (was wirklich passiert), nicht
/// „an/aus": „öffentlich" = alle aktiven Vereinsmitglieder sehen es,
/// „intern" = nur Vorstand und Trainerstab. Durchgesetzt wird die Stufe
/// serverseitig (redactSelfProfile) — hier wird nur der Wert gesetzt.
///
/// Diese Karte hängt AUSSCHLIESSLICH im eigenen Profil; fremde Profile sind
/// über sie nicht erreichbar (und der Server ließe es ohnehin nicht zu).
struct ProfileSelfCard: View {
    @ObservedObject var viewModel: ProfileSelfViewModel
    let onSave: () -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "profil.self.eyebrow", title: "profil.self.title")
                Text("profil.self.intro")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)

                switch viewModel.state {
                case .idle, .loading:
                    loadingRow
                case .unavailable:
                    Text("profil.self.unavailable")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                case .failed(let message):
                    failure(message)
                case .loaded:
                    form
                }
            }
        }
    }

    // MARK: - Zustände

    private var loadingRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Colors.brand)
            Text("profil.self.loading")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget, alignment: .leading)
    }

    private func failure(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("profil.self.loadError")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(verbatim: message)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Formular

    private var form: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            mottoField
            disciplineField
            yearField
            visibilityChoice

            if viewModel.saved {
                Label("profil.self.saved", systemImage: "checkmark.circle.fill")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.success)
                    .transition(.opacity)
            }

            actions
        }
    }

    private var mottoField: some View {
        fieldGroup(
            label: "profil.self.field.motto",
            error: viewModel.mottoTooLong ? "profil.self.err.mottoLong" : nil
        ) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                TextField(
                    "profil.self.field.motto.ph",
                    text: $viewModel.motto,
                    axis: .vertical
                )
                .lineLimit(3...6)
                .modifier(ProfileFieldChrome())
                .accessibilityLabel(Text("profil.self.field.motto"))

                HStack {
                    Text("profil.self.field.motto.hint")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                    Spacer(minLength: Theme.Spacing.s2)
                    Text("profil.self.remaining \(viewModel.mottoRemaining)")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(
                            viewModel.mottoTooLong ? Theme.Colors.danger : Theme.Colors.inkFaint
                        )
                        .accessibilityHidden(true)
                }
            }
        }
    }

    private var disciplineField: some View {
        fieldGroup(
            label: "profil.self.field.discipline",
            error: viewModel.disciplineTooLong ? "profil.self.err.disciplineLong" : nil
        ) {
            TextField("profil.self.field.discipline.ph", text: $viewModel.discipline)
                .textInputAutocapitalization(.words)
                .modifier(ProfileFieldChrome())
                .accessibilityLabel(Text("profil.self.field.discipline"))
        }
    }

    private var yearField: some View {
        fieldGroup(label: "profil.self.field.year", error: viewModel.skatingError) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                TextField("profil.self.field.year.ph", text: $viewModel.skatingSince)
                    .keyboardType(.numberPad)
                    .modifier(ProfileFieldChrome())
                    .onChange(of: viewModel.skatingSince) { viewModel.skatingError = nil }
                    .accessibilityLabel(Text("profil.self.field.year"))
                Text("profil.self.field.year.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }

    // MARK: - Sichtbarkeit (ehrlich beschriftet)

    private var visibilityChoice: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("profil.self.visibility.legend")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)

            VStack(spacing: Theme.Spacing.s2) {
                visibilityOption(
                    value: .public,
                    systemImage: "globe",
                    title: "profil.self.visibility.public.title",
                    desc: "profil.self.visibility.public.desc"
                )
                visibilityOption(
                    value: .internal,
                    systemImage: "lock.fill",
                    title: "profil.self.visibility.internal.title",
                    desc: "profil.self.visibility.internal.desc"
                )
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("profil.self.visibility.legend"))
    }

    private func visibilityOption(
        value: ProfileVisibility,
        systemImage: String,
        title: LocalizedStringKey,
        desc: LocalizedStringKey
    ) -> some View {
        let isSelected = viewModel.visibility == value
        return Button {
            withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                viewModel.visibility = value
            }
        } label: {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
                    .frame(width: 34, height: 34)
                    .background(isSelected ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(desc)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Theme.Spacing.s2)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.Colors.brand : Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
            .padding(Theme.Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                    .strokeBorder(
                        isSelected ? Theme.Colors.brand : Theme.Colors.line,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    // MARK: - Aktionen

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Button {
                viewModel.reset()
            } label: {
                Text("profil.self.reset")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(
                        viewModel.isDirty ? Theme.Colors.inkSoft : Theme.Colors.inkFaint
                    )
                    .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(!viewModel.isDirty || viewModel.isSaving)

            RSMPrimaryButton(title: "profil.self.save", isLoading: viewModel.isSaving) {
                onSave()
            }
            .disabled(!viewModel.canSave)
            .opacity(viewModel.canSave ? 1 : 0.5)
        }
    }

    // MARK: - Feld-Gerüst

    private func fieldGroup(
        label: LocalizedStringKey,
        error: LocalizedStringKey?,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            content()
            if let error {
                Text(error)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
