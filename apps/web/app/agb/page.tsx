import type { Metadata } from "next";
import { LegalPage } from "../_landing/LegalPage";

export const metadata: Metadata = {
  title: "AGB",
  description:
    "Allgemeine Geschäftsbedingungen von RollsportManager — Nutzung des Dienstes, Konten, Vereinslizenz, Haftung und Kündigung.",
};

/**
 * Allgemeine Geschäftsbedingungen. Eingebauter Standard aus v1
 * (legal-defaults.ts, Abschnitt 5 an das v2-Lizenzmodell angepasst); der
 * Betreiber kann ihn im (super)-Bereich überschreiben. Noch nicht anwaltlich
 * geprüft — das sagt die Seite auch selbst.
 */
export default function AgbPage() {
  return <LegalPage kind="agb" />;
}
