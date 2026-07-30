import type { Metadata } from "next";
import { VereineClient } from "./VereineClient";

/**
 * Öffentliches, login-freies Vereinsverzeichnis `/vereine`. Zeigt die Vereine,
 * die ihr Profil ausdrücklich freigegeben haben (public_profile_enabled), mit
 * Name, Ort, Sparte, kurzer Beschreibung und Logo — NICHTS Personenbezogenes.
 * Daten über die Facade (listPublicClubs → GET /public/clubs, ohne Auth).
 */
export const metadata: Metadata = {
  title: "Vereine",
  description:
    "Rollkunstlauf- und Eiskunstlauf-Vereine, die RollsportManager nutzen — finde einen Verein in deiner Nähe.",
};

export default function VereinePage() {
  return <VereineClient />;
}
