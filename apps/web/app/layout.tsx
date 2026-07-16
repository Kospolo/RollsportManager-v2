import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import { OperatorBanner } from "@/components/shell/OperatorBanner";
import { PreferencesBoot } from "@/lib/boot/PreferencesBoot";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { themeInitScript } from "@/lib/theme/script";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RollsportManager",
    template: "%s · RollsportManager",
  },
  description:
    "Vereins-Management für Rollkunstlauf: Termine, Mitglieder, Küren, Wettkampf und Finanzen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: das Inline-Script setzt data-theme (und der
    // I18nProvider ggf. lang) vor bzw. nach der Hydration am <html>-Element.
    <html lang="de" suppressHydrationWarning className={`${fontVariables} antialiased`}>
      <body className="min-h-dvh">
        {/* Läuft synchron vor dem ersten Paint — kein Theme-Flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <I18nProvider>
            {/* Dev-Auth-Session (rsm.dev.auth) — im mock-Modus wirkungslos. */}
            <AuthProvider>
              {/* Zieht nach dem Login Theme/Locale aus /me/preferences (api). */}
              <PreferencesBoot />
              {/* DAS BETREIBER-BAND — bewusst im ROOT-Layout, nicht in der
                  Portal-Shell: die Betreiber-Einsicht gilt für JEDE Seite, die
                  der Betreiber danach aufruft, und sie muss überall sichtbar
                  bleiben (auch auf der Konsole selbst). Rendert für alle
                  anderen null. */}
              <OperatorBanner />
              {children}
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
