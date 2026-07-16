import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { BottomNav } from "@/components/shell/BottomNav";
import { AuthGate } from "@/components/shell/AuthGate";
import { ToastProvider } from "@/components/ui/Toast";
import { CapabilitiesProvider } from "@/lib/capabilities";

/**
 * Portal-Shell: Sidebar (Desktop) + Topbar + Inhalt + BottomNav (Mobile).
 * Canvas-Hintergrund, Surface-Flächen — Look gemäß mockup-final.html.
 * ToastProvider hängt hier, damit jeder Screen useToast() nutzen kann.
 * AuthGate: nur im api-Modus aktiv — ohne Dev-Login-Token → /login.
 * CapabilitiesProvider: GET /me/capabilities einmal je Session-Ansicht —
 * Grundlage des Anzeige-Gatings. Er hängt INNERHALB von AuthGate, weil er
 * einen Token braucht; und er ist reine Kosmetik (siehe lib/capabilities).
 */
export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-h-dvh min-w-0 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10 lg:pt-7">
            <AuthGate>
              <CapabilitiesProvider>{children}</CapabilitiesProvider>
            </AuthGate>
          </main>
        </div>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
