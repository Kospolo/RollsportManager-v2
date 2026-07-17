import type { Metadata } from "next";
import { SpartenScreen } from "./_components/SpartenScreen";

export const metadata: Metadata = { title: "Sparten" };

export default function SpartenPage() {
  return <SpartenScreen />;
}
