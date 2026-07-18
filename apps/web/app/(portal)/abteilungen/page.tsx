import type { Metadata } from "next";
import { DepartmentsScreen } from "./_components/DepartmentsScreen";

export const metadata: Metadata = { title: "Gruppen" };

export default function AbteilungenPage() {
  return <DepartmentsScreen />;
}
