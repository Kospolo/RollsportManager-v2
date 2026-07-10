import type { Metadata } from "next";
import { MedaillenScreen } from "./_components/MedaillenScreen";

export const metadata: Metadata = { title: "Meine Medaillen" };

export default function MedaillenPage() {
  return <MedaillenScreen />;
}
