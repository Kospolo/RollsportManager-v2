import type { Metadata } from "next";
import { TrainingsplanScreen } from "./_components/TrainingsplanScreen";

export const metadata: Metadata = { title: "Trainingsplan" };

export default function TrainingsplanPage() {
  return <TrainingsplanScreen />;
}
