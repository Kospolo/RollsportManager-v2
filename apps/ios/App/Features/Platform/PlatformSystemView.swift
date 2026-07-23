import SwiftUI

/// Betreiber-Sicht „System": Laufzeit-Auskunft der Plattform.
/// Web-Referenz: apps/web/app/(super)/system.
///
/// Vier Blöcke, in der Reihenfolge, in der man sie um 22 Uhr braucht:
/// Gesundheit → Betriebsart → Datenbank → Migrationsstand.
///
/// ### DER AUTH-MODUS IST HIER KEINE NEBENSACHE ###
/// `auth_mode = dev` bedeutet: die Persona-Login-Route ist offen. Auf einer
/// echten Instanz wäre das ein Befund, kein Detail — deshalb steht er als
/// eigener, farbig markierter Hinweis und nicht als graue Zeile unter vielen.
struct PlatformSystemView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<PlatformSystem>()

    var body: some View {
        PlatformSectionScreen(
            title: "platform.system.title",
            model: model,
            fetch: { try await session.api.getPlatformSystem() }
        ) { system in
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                healthCard(system)
                databaseCard(system.db)
                migrationsCard(system.migrations)
            }
        }
    }

    // MARK: - Gesundheit + Betriebsart

    private func healthCard(_ system: PlatformSystem) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "platform.system.health.eyebrow",
                    title: "platform.system.health.title"
                )
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.Colors.success)
                        .accessibilityHidden(true)
                    Text("platform.system.health.ok")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.system.appVersion",
                        value: Text(verbatim: system.appVersion),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.dbTime",
                        value: PlatformFormat.dateTime(system.health.dbTime),
                        monospaced: true
                    )
                }

                authModeNote(system.authMode)
            }
        }
    }

    @ViewBuilder
    private func authModeNote(_ mode: PlatformSystemAuthMode) -> some View {
        let isDev = mode == .dev
        Label(
            isDev ? "platform.system.auth.dev" : "platform.system.auth.prod",
            systemImage: isDev ? "wrench.and.screwdriver.fill" : "lock.fill"
        )
        .font(Theme.Fonts.caption)
        .foregroundStyle(isDev ? Theme.Colors.warn : Theme.Colors.success)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(isDev ? Theme.Colors.warnSoft : Theme.Colors.successSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Datenbank

    private func databaseCard(_ db: PlatformSystemDb) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "platform.system.db.eyebrow",
                    title: "platform.system.db.title"
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.system.db.size",
                        value: Text(verbatim: db.sizePretty),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.db.clubs",
                        value: PlatformFormat.count(db.clubs),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.db.users",
                        value: PlatformFormat.count(db.users),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.db.members",
                        value: PlatformFormat.count(db.members),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.db.entitlements",
                        value: PlatformFormat.count(db.activeEntitlements),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.db.webhooks",
                        value: PlatformFormat.count(db.webhookEvents),
                        monospaced: true
                    )
                }
            }
        }
    }

    // MARK: - Migrationen

    private func migrationsCard(_ migrations: PlatformSystemMigrations) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "platform.system.migrations.eyebrow",
                    title: "platform.system.migrations.title"
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.system.migrations.count",
                        value: PlatformFormat.count(migrations.count),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.system.migrations.latest",
                        value: PlatformFormat.text(migrations.latest),
                        monospaced: true
                    )
                }

                // Die letzten zehn reichen: wer die ganze Liste braucht, sitzt
                // ohnehin vor einem grossen Bildschirm.
                if !migrations.list.isEmpty {
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            ForEach(migrations.list.suffix(10).reversed(), id: \.self) { name in
                                Text(verbatim: name)
                                    .font(Theme.Fonts.monoCaption)
                                    .foregroundStyle(Theme.Colors.inkSoft)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, Theme.Spacing.s2)
                    } label: {
                        Text("platform.system.migrations.recent")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .tint(Theme.Colors.brandInk)
                }
            }
        }
    }
}
