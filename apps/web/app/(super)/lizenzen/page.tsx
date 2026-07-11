import type { Metadata } from "next";
import { LizenzenClient } from "./LizenzenClient";

export const metadata: Metadata = { title: "Lizenzen" };

export default function LizenzenPage() {
  return <LizenzenClient />;
}
