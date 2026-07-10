import type { Metadata } from "next";
import { WettkampfClient } from "./WettkampfClient";

export const metadata: Metadata = { title: "Wettkampf" };

export default function CompetitionPage() {
  return <WettkampfClient />;
}
