import type { Metadata } from "next";
import { LegalPage } from "../_landing/LegalPage";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Datenschutzerklärung von RollsportManager — welche Daten verarbeitet werden, wer sie sieht und welche Rechte du hast.",
};

/**
 * Beschreibt die Verarbeitung zutreffend — einschließlich der Gesundheitsdaten
 * aus Krankmeldungen und der internen Trainer-Notizen. Noch nicht anwaltlich
 * geprüft; das sagt die Seite auch selbst.
 */
export default function DatenschutzPage() {
  return <LegalPage kind="datenschutz" />;
}
