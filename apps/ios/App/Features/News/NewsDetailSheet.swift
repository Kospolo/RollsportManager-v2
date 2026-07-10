import SwiftUI

/// Detail-Ansicht einer Neuigkeit als Sheet: Chips, Autor mit Avatar,
/// Datum + relative Angabe, vollständiger Text (Zeilenumbrüche erhalten).
/// Rein lesend — Bearbeiten/Löschen bietet die iOS-API (`Endpoints.swift`)
/// derzeit nicht an. Web-Referenz: news/_components/NewsDetailSheet.tsx.
struct NewsDetailSheet: View {
    let news: News
    /// Aufgelöster Autorenname; `nil` → „Unbekannt“.
    let authorName: String?
    @Environment(\.dismiss) private var dismiss

    private var authorDisplay: String {
        authorName ?? String(localized: "news.author.unknown")
    }

    private var displayIso: String { news.publishedAt ?? news.createdAt }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            header
                            if news.isPinned || news.publishedAt == nil {
                                NewsBadges(news: news)
                            }
                            authorRow
                            Divider().overlay(Theme.Colors.line)
                            Text(verbatim: news.body)
                                .font(Theme.Fonts.body)
                                .foregroundStyle(Theme.Colors.inkPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("news.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("news.detail.close") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("news.detail.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: news.title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    private var authorRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: authorDisplay, personId: news.authorMemberId, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: authorDisplay)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(verbatim: "\(NewsDate.absolute(displayIso)) · \(NewsDate.relativeText(displayIso))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            Spacer(minLength: 0)
        }
    }
}
