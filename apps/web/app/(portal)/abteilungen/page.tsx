import type { Metadata } from "next";
import { DepartmentsScreen } from "./_components/DepartmentsScreen";

export const metadata: Metadata = { title: "Abteilungen" };

export default function AbteilungenPage() {
  return <DepartmentsScreen />;
}
