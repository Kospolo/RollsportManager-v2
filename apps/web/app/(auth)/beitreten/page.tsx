import type { Metadata } from "next";
import { JoinClubCard } from "./JoinClubCard";

export const metadata: Metadata = {
  title: "Verein beitreten",
  description: "Mit dem Vereinscode einen Beitritt beantragen.",
};

export default function BeitretenPage() {
  return <JoinClubCard />;
}
