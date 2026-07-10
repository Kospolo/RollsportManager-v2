import type { Metadata } from "next";
import { NewsScreen } from "./_components/NewsScreen";

export const metadata: Metadata = { title: "Neuigkeiten" };

export default function NewsPage() {
  return <NewsScreen />;
}
