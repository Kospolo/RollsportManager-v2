"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { dataSource, permissions } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useT, type Dict } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Sicht-Gate der Betreiber-Ebene — herausgezogen aus PlatformConsoleClient,
 * damit jede neue (super)-Seite dieselbe Entscheidung trifft statt sie zu
 * kopieren (und beim Kopieren zu variieren).
 *
 * REINE SICHTBARKEIT, KEIN SCHUTZ. Der Schutz ist der Server: jeder
 * /platform/*-Endpoint prüft requirePlatformAdmin selbst, und wer die URL
 * errät, bekommt hier zwar die Sperr-Seite — vor allem aber vom Server 403.
 * Dieses Gate spart nur den sinnlosen Fetch und die hässliche Fehlermeldung.
 *
 * Externer Store (useSyncExternalStore) statt setState-im-Effect: SSR und der
 * erste Client-Render liefern beide "checking", danach übernimmt der Client —
 * kein Hydration-Mismatch (gleiches Muster wie lib/i18n und lib/theme).
 *
 * mock-Modus: es gibt keine Dev-Session, also keinen Claim. Die Konsole wird
 * dort als Demo freigeschaltet ({ isPlatformAdmin: true }) — sonst wäre der
 * ganze (super)-Bereich ohne laufenden Dev-Stack unsichtbar. Der echte Schutz
 * bleibt serverseitig; im mock-Modus gibt es keinen Server, der lügen könnte.
 */

const gateDict = {
  de: {
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

type Access = "checking" | "granted" | "denied";

function readAccess(): Access {
  const isAdmin = permissions(
    null,
    dataSource === "mock" ? { isPlatformAdmin: true } : undefined,
  ).isPlatformAdmin;
  return isAdmin ? "granted" : "denied";
}

function serverAccess(): Access {
  return "checking";
}

/** true, sobald der Client entschieden hat und der Claim da ist. */
export function useIsOperator(): boolean {
  return useSyncExternalStore(subscribeAuth, readAccess, serverAccess) === "granted";
}

export function OperatorGate({ children }: { children: ReactNode }) {
  const t = useT(gateDict);
  const access = useSyncExternalStore(subscribeAuth, readAccess, serverAccess);

  if (access === "checking") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <EmptyState
        icon="lock"
        title={t("noAccessTitle")}
        body={t("noAccessBody")}
        ctaHref="/dashboard"
        ctaLabel={t("backToPortal")}
      />
    );
  }

  return <>{children}</>;
}
