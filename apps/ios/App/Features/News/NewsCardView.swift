import SwiftUI

/// Neuigkeits-Karte (Schwarzes Brett): Angepinnt-/Entwurf-Chip, Titel,
/// Autor + Datum, dreizeiliger Text-Anriss. Die ganze Karte ist ein Button
/// (44-pt-Ziel) und öffnet die Detail-Ansicht. Autorenname kommt aufgelöst
/// als Prop aus dem ViewModel. Web-Referenz: news/_components/NewsCard.tsx.
struct NewsCardView: View {
    let news: News
    /// Aufgelöster Autorenname; `nil` → „Unbekannt“.
    let authorName: String?
    let action: () -> Void

    private var authorDisplay: String {
        authorName ?? String(localized: "news.author.unknown")
    }

    /// Angezeigtes Datum: Veröffentlichung, sonst Anlage (Entwurf).
    private var displayDate: String {
        NewsDate.absolute(news.publishedAt ?? news.createdAt)
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                if news.isPinned || news.publishedAt == nil {
                    NewsBadges(news: news)
                }
                Text(verbatim: news.title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .multilineTextAlignment(.leading)
                meta
                Text(verbatim: news.body)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s5)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityHint(Text("news.card.a11y.hint"))
    }

    private var meta: some View {
        HStack(spacing: Theme.Spacing.s4) {
            metaItem(icon: "person.fill", text: Text("news.card.byAuthor \(authorDisplay)"))
            metaItem(icon: "clock", text: Text(verbatim: displayDate))
        }
    }

    private func metaItem(icon: String, text: Text) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            text
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
        }
    }
}

/// Chip-Reihe „Angepinnt“ (Brand + Pin) und „Entwurf“ (Warn) — geteilt von
/// Karte und Detail-Sheet, damit beide dieselbe Semantik zeigen.
struct NewsBadges: View {
    let news: News

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if news.isPinned {
                NewsPinnedBadge()
            }
            if news.publishedAt == nil {
                RSMStatusPill(text: "news.badge.draft", kind: .warn)
            }
        }
    }
}

/// Angepinnt-Chip mit Pin-Symbol (RSMStatusPill trägt kein Icon, daher eigen).
struct NewsPinnedBadge: View {
    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "pin.fill")
                .font(.system(size: 10, weight: .semibold))
                .accessibilityHidden(true)
            Text("news.badge.pinned")
                .font(Theme.Fonts.caption.weight(.semibold))
        }
        .foregroundStyle(Theme.Colors.brandInk)
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s1)
        .background(Theme.Colors.brandSoft)
        .clipShape(Capsule())
    }
}
