import type { Metadata } from "next";
import { PflichtstundenScreen } from "./_components/PflichtstundenScreen";

export const metadata: Metadata = { title: "Pflichtstunden" };

export default function PflichtstundenPage() {
  return <PflichtstundenScreen />;
}
