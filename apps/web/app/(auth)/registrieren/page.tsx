import type { Metadata } from "next";
import { RegisterClubCard } from "./RegisterClubCard";

export const metadata: Metadata = {
  title: "Verein anlegen",
  description: "Lege deinen Verein an und teste RollsportManager 30 Tage kostenlos.",
};

export default function RegistrierenPage() {
  return <RegisterClubCard />;
}
