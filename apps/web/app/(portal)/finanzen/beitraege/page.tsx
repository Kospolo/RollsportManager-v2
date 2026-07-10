import type { Metadata } from "next";
import { MemberFeesClient } from "./MemberFeesClient";

export const metadata: Metadata = { title: "Mitgliedsbeiträge" };

/**
 * Mitgliedsbeiträge — Verwaltungssicht der Finanzen (Seriositätszone). Zeigt
 * alle Mitglieder mit ihrer Beitragszuordnung (Kategorie, effektiver Betrag,
 * Gültigkeit, SEPA-Status) und erlaubt Zuordnen/Ändern über die Facade
 * (assignMemberFee/updateMemberFee/removeMemberFee). Sichtbarkeit ist auf
 * can_manage_finance gegatet — verbindlich serverseitig via RLS.
 */
export default function MemberFeesPage() {
  return <MemberFeesClient />;
}
