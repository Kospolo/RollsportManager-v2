import type { Metadata } from "next";
import { DocumentsScreen } from "./_components/DocumentsScreen";

export const metadata: Metadata = { title: "Dokumente" };

export default function DokumentePage() {
  return <DocumentsScreen />;
}
