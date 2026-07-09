import type { Metadata } from "next";
import { StyleguideClient } from "./StyleguideClient";

export const metadata: Metadata = { title: "Styleguide" };

/**
 * Visuelle Abnahme-Seite der Komponentenbibliothek — bewusst NICHT
 * in der Sidebar verdrahtet und später wieder zu entfernen.
 * Aufruf direkt über /styleguide.
 */
export default function StyleguidePage() {
  return <StyleguideClient />;
}
