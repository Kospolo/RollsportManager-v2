import type { Metadata } from "next";
import { EquipmentScreen } from "./_components/EquipmentScreen";

export const metadata: Metadata = { title: "Ausrüstung" };

export default function AusruestungPage() {
  return <EquipmentScreen />;
}
