import type { Metadata } from "next";
import { ExercisesLibrary } from "./_components/ExercisesLibrary";

export const metadata: Metadata = { title: "Übungsbibliothek" };

export default function ExercisesPage() {
  return <ExercisesLibrary />;
}
