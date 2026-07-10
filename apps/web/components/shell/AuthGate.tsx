"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { dataSource } from "@/lib/data";
import { SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Zugangsschutz der Portal-Shell — nur im api-Modus aktiv:
 * ohne gültigen Dev-Login-Token geht es per replace zurück auf /login.
 * Im mock-Modus (Default) rendert das Gate transparent durch.
 *
 * Der Token liegt in localStorage, deshalb ist die Prüfung clientseitig;
 * bis zur Hydration zeigt das Gate ruhige Skeleton-Karten statt Inhalt.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (dataSource === "api" && status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  if (dataSource === "mock") return <>{children}</>;
  if (status === "authenticated") return <>{children}</>;

  // loading (vor Hydration) oder anonymous (Redirect läuft bereits)
  return (
    <div className="grid gap-4" aria-busy="true">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={5} />
    </div>
  );
}
