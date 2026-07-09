import Link from "next/link";
import { Icon, type IconName } from "@/components/shell/icons";

/**
 * Leerer Zustand mit Handlung (DESIGN-SYSTEM §3.10):
 * Icon + ein Satz + CTA — nie eine stumme leere Fläche.
 */
export function EmptyState({
  icon = "sparkle",
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon?: IconName;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="grid place-items-center rounded-xl border border-line bg-surface px-6 py-14 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-sunken text-ink-soft">
        <Icon name={icon} className="ic h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-h3 text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-body text-ink-soft">{body}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand-soft px-5 font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
        >
          {ctaLabel}
        </Link>
      )}
    </section>
  );
}
