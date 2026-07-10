import type { ReactNode } from "react";
import { OperatorTopbar } from "./OperatorTopbar";

/**
 * Plattform-/Betreiber-Layout — AUSSERHALB der Vereins-Shell (kein Sidebar,
 * keine BottomNav). Nur die Betreiber-Chrome + Inhalt auf Canvas. Die globalen
 * Provider (Theme, i18n, Auth) hängen bereits im Root-Layout.
 */
export default function SuperLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-canvas">
      <OperatorTopbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 lg:px-8">{children}</main>
    </div>
  );
}
