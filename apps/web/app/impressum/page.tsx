import type { Metadata } from "next";
import { LegalPage } from "../_landing/LegalPage";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum von RollsportManager (Platzhalter für die Entwicklungsphase).",
};

/** Platzhalter-Route: vollständige Angaben folgen vor dem öffentlichen Start. */
export default function ImpressumPage() {
  return <LegalPage kind="impressum" />;
}
