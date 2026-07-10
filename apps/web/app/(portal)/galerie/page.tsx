import type { Metadata } from "next";
import { GalerieScreen } from "./_components/GalerieScreen";

export const metadata: Metadata = { title: "Galerie" };

export default function GaleriePage() {
  return <GalerieScreen />;
}
