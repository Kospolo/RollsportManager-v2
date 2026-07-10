import type { Metadata } from "next";
import { RoutinesList } from "./_components/RoutinesList";

export const metadata: Metadata = { title: "Küren" };

export default function RoutinesPage() {
  return <RoutinesList />;
}
