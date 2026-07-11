import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { OperatorTopbar } from "./OperatorTopbar";
import { OperatorNav } from "./OperatorNav";

/**
 * Plattform-/Betreiber-Layout — AUSSERHALB der Vereins-Shell (kein Sidebar,
 * keine BottomNav). Betreiber-Chrome (Topbar + Sektions-Nav) + Inhalt auf
 * Canvas. Die globalen Provider (Theme, i18n, Auth) hängen im Root-Layout;
 * der ToastProvider hier ermöglicht Klartext-Rückmeldungen der Schreibpfade
 * (z. B. Lizenz gesetzt / 403 ohne Berechtigung).
 */
export default function SuperLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-canvas">
        <OperatorTopbar />
        <OperatorNav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 lg:px-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
