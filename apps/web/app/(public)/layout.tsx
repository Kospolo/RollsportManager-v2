import type { ReactNode } from "react";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

/**
 * Öffentliche Route-Gruppe (kein Portal-Chrome, KEIN AuthGate) — für die
 * login-freie Kür-Ansicht `/wettkampf/kuer/{token}`. Nutzt das Root-Layout
 * (Theme/i18n/Fonts), aber ein schlankes eigenes Gerüst im Heimspiel-Look:
 * Marken-Kopf mit Theme-/Sprach-Umschalter, zentrierter Inhalt, dezenter Fuß.
 * Bewusst getrennt vom Portal-Layout, damit hier weder Sidebar noch AuthGate
 * greifen (siehe route-groups: verschiedene Gruppen, unterschiedliche Layouts).
 */
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <BrandMark />
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <LanguageChip />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 sm:px-6">{children}</main>
      <footer className="border-t border-line px-4 py-4 text-center text-caption text-ink-faint sm:px-6">
        RollsportManager
      </footer>
    </div>
  );
}
