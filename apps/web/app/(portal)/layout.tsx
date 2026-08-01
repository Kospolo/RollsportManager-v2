import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { BottomNav } from "@/components/shell/BottomNav";
import { AuthGate } from "@/components/shell/AuthGate";
import { BetaViewerBoundary } from "@/components/shell/BetaViewerBoundary";
import { OnboardingGate } from "@/components/shell/OnboardingGate";
import { OperatorPortalGate } from "@/components/shell/OperatorPortalGate";
import { ToastProvider } from "@/components/ui/Toast";
import { CapabilitiesProvider } from "@/lib/capabilities";
import { ModulesProvider } from "@/lib/modules";

/**
 * Portal-Shell: Sidebar (Desktop) + Topbar + Inhalt + BottomNav (Mobile).
 * Canvas-Hintergrund, Surface-Flächen — Look gemäß mockup-final.html.
 * ToastProvider hängt hier, damit jeder Screen useToast() nutzen kann.
 * AuthGate: nur im api-Modus aktiv — ohne Dev-Login-Token → /login.
 * OperatorPortalGate: fängt den Plattform-Admin OHNE gewählten Verein ab und
 * zeigt eine Auswahl statt des „Nicht angemeldet"-Fehlers (normale Nutzer:innen
 * mit Heimatverein laufen unverändert durch).
 *
 * CapabilitiesProvider (GET /me/capabilities, einmal je Ansicht) wrappt die
 * GANZE Shell und nicht nur `children`: Sidebar und BottomNav entscheiden über
 * useVisibleNavItems, ob „Verwaltung" erscheint, und stehen AUSSERHALB von
 * AuthGate. Läge der Provider nur um die children, würfe useCapabilities() dort
 * zur Laufzeit — ein Fehler, den kein Typecheck und kein Build sieht.
 * Dass er damit vor AuthGate liegt, ist unkritisch: ohne Token antwortet die
 * API 401, die Auflösung bleibt leer und das Gating ist fail-closed (keine
 * Verwaltung). Er ist ohnehin nur Kosmetik — der Schutz ist der Server.
 */
export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // BetaViewerBoundary ganz außen: Sidebar, Topbar und BottomNav lesen die
    // eingeloggte Person selbst (Namenskürzel, sichtbare Menüpunkte). Läge die
    // Grenze weiter innen, wechselte nur der Inhalt und die Hülle zeigte
    // weiter die alte Person.
    <BetaViewerBoundary>
      <ToastProvider>
        <CapabilitiesProvider>
         <ModulesProvider>
          <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
            <Sidebar />
            <div className="flex min-h-dvh min-w-0 flex-col">
              <Topbar />
              <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10 lg:pt-7">
                <AuthGate>
                  <OnboardingGate>
                    <OperatorPortalGate>{children}</OperatorPortalGate>
                  </OnboardingGate>
                </AuthGate>
              </main>
            </div>
            <BottomNav />
          </div>
         </ModulesProvider>
        </CapabilitiesProvider>
      </ToastProvider>
    </BetaViewerBoundary>
  );
}
