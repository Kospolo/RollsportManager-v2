import type { Metadata } from "next";
import { EntwicklerClient } from "./EntwicklerClient";

/**
 * Interner Bereich der Beta: Auswahl der Demo-Person.
 *
 * Nirgends verlinkt und ausdrücklich nicht indexiert. Auf der Beta gilt der
 * noindex ohnehin für jede Seite (RSM_BETA=1); hier steht er zusätzlich, damit
 * die Sperre auch dann bestehen bleibt, wenn diese App irgendwann OHNE
 * Beta-Kennzeichnung läuft.
 *
 * Nur auf Deutsch — anders als das Portal, das durchgehend zweisprachig ist.
 * Das hier ist kein Produktmerkmal, das je bei einem Verein ankommt, sondern
 * ein Werkzeug fuer die Entwicklung. Sollte es doch einmal öffentlich werden,
 * gehört es zweisprachig.
 */
export const metadata: Metadata = {
  title: "Entwickler-Ansicht",
  description: "Interne Auswahl der Demo-Person für die Beta.",
  robots: { index: false, follow: false, nocache: true },
};

export default function EntwicklerPage() {
  return <EntwicklerClient />;
}
