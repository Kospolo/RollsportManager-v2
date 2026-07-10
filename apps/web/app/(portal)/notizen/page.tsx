import type { Metadata } from "next";
import { NotesClient } from "./NotesClient";

export const metadata: Metadata = { title: "Notizen" };

export default function NotesPage() {
  return <NotesClient />;
}
