import type { Metadata } from "next";
import { VerwaltungHub } from "./VerwaltungHub";

export const metadata: Metadata = { title: "Verwaltung" };

export default function VerwaltungPage() {
  return <VerwaltungHub />;
}
