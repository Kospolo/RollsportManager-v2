import type { Metadata } from "next";
import { LegalPage } from "../_landing/LegalPage";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Datenschutzerklärung von RollsportManager (Platzhalter für die Entwicklungsphase).",
};

/** Platzhalter-Route: rechtlich geprüfter Text folgt vor dem öffentlichen Start. */
export default function DatenschutzPage() {
  return <LegalPage kind="datenschutz" />;
}
