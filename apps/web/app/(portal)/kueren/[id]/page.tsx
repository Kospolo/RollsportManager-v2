import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routines, routineById } from "@/lib/mock";
import { RoutineDetail } from "./_components/RoutineDetail";

/** Alle Kür-Detailseiten kommen aus den Mock-Daten — statisch generierbar. */
export function generateStaticParams() {
  return routines.map((routine) => ({ id: routine.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const routine = routineById(id);
  return { title: routine ? `${routine.title} · Küren` : "Küren" };
}

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!routineById(id)) notFound();
  return <RoutineDetail routineId={id} />;
}
