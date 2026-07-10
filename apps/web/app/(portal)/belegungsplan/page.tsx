import type { Metadata } from "next";
import { BelegungsplanScreen } from "./_components/BelegungsplanScreen";

export const metadata: Metadata = { title: "Belegungsplan" };

export default function BelegungsplanPage() {
  return <BelegungsplanScreen />;
}
