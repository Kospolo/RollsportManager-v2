import type { Metadata } from "next";
import { ProfilScreen } from "./_components/ProfilScreen";

export const metadata: Metadata = { title: "Profil" };

export default function ProfilPage() {
  return <ProfilScreen />;
}
