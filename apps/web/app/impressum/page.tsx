import type { Metadata } from "next";
import { LegalPage } from "../_landing/LegalPage";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum von RollsportManager — Anbieterkennzeichnung nach § 5 TMG.",
};

/**
 * Angaben nach § 5 TMG. Inhalt wörtlich aus der Produktivseite von v1 —
 * derselbe Betreiber, dieselben Angaben. Kein Platzhalter mehr.
 */
export default function ImpressumPage() {
  return <LegalPage kind="impressum" />;
}
