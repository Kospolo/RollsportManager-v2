import type { Metadata } from "next";
import { JubilaeenScreen } from "./_components/JubilaeenScreen";

export const metadata: Metadata = { title: "Jubiläen" };

/**
 * Jubiläen (Geburtstage & Vereinsjubiläen) — reine Lesesicht auf die kommenden
 * Meilensteine der nächsten zwölf Monate über data.getAnniversaries(). Für alle
 * Mitglieder sichtbar (is_club_member); das Scoping bleibt serverseitig.
 */
export default function JubilaeenPage() {
  return <JubilaeenScreen />;
}
