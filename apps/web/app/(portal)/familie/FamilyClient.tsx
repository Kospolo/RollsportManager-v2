"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, fullName, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import type { ChildCreated, Guardianship, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { familieDict, RELATION_KEY } from "./i18n";
import {
  childrenOf,
  duesStatus,
  guardiansOf,
  softNotImplemented,
  type DuesStatus,
  type FamilyLink,
} from "./derive";
import { ChildCard, FamilySection, PersonCard } from "./_components/FamilyCards";
import { CreateChildDialog } from "./_components/CreateChildDialog";
import { LinkChildSheet } from "./_components/LinkChildSheet";
import { RemoveGuardianshipDialog } from "./_components/RemoveGuardianshipDialog";

/**
 * Familien-Screen der eingeloggten Person: „Meine Kinder" wird zur Verwaltung
 * ausgebaut — Kind anlegen (createChild), bestehendes Mitglied als Kind
 * verknüpfen (addGuardianship) und Verknüpfung entfernen (removeGuardianship,
 * mit Bestätigung). Das Recht dazu ist Selfservice (eigene Kinder) und wird
 * SERVERSEITIG erzwungen — die UI ist reine Anzeige, ein 403 wird zum ruhigen
 * Toast. „Eltern & Bezugspersonen" bleibt rein lesend.
 *
 * Daten kommen ausschließlich über die Facade (lib/data): getCurrentUser +
 * getGuardianships + getMembers sind Pflicht; Teams und Rechnungen sind im
 * api-Modus optional (NotImplemented ⇒ Zusatzangaben entfallen still).
 *
 * Mutationen werden optimistisch als Overlay geführt (added/removedIds) und
 * per guardianshipId dedupliziert — so ist die Ansicht im mock-Modus (dessen
 * Schreibpfade nicht in den Lese-Store zurückschreiben) UND im api-Modus (wo
 * reload() die kanonischen Daten nachzieht) korrekt.
 */

/* ---------- Optimistischer Overlay ---------- */

type Overlay = { added: FamilyLink[]; removedIds: ReadonlySet<string> };

const EMPTY_OVERLAY: Overlay = { added: [], removedIds: new Set() };

export function FamilyClient() {
  const t = useT(familieDict);
  const { hasCap } = useCapabilities();

  const state = useData((repo) =>
    Promise.all([
      repo.getCurrentUser(),
      repo.getGuardianships(),
      repo.getMembers(),
      softNotImplemented(repo.getTeams()),
      softNotImplemented(repo.getInvoices()),
    ] as const),
  );

  const [overlay, setOverlay] = useState<Overlay>(EMPTY_OVERLAY);
  const [showCreate, setShowCreate] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [toRemove, setToRemove] = useState<FamilyLink | null>(null);

  const { reload } = state;

  const addChild = (link: FamilyLink) => {
    setOverlay((prev) => ({ ...prev, added: [...prev.added, link] }));
    reload(); // im api-Modus kanonische Daten (Dues/Team) nachziehen; mock: no-op
  };
  const onCreated = (result: ChildCreated) =>
    addChild({
      guardianshipId: result.guardianship.id,
      member: result.child,
      relation: result.guardianship.relation,
    });
  const onLinked = (guardianship: Guardianship, member: Member) =>
    addChild({ guardianshipId: guardianship.id, member, relation: guardianship.relation });
  const onRemoved = (guardianshipId: string) => {
    setOverlay((prev) => ({
      ...prev,
      removedIds: new Set([...prev.removedIds, guardianshipId]),
    }));
    reload();
  };

  const me = state.data?.[0] ?? null;
  const guardianships = useMemo(() => state.data?.[1] ?? [], [state.data]);
  const members = useMemo(() => state.data?.[2] ?? [], [state.data]);
  const teams = state.data?.[3] ?? null;
  const invoices = state.data?.[4] ?? null;

  /** Kinder = Basis + optimistisch ergänzte, per guardianshipId dedupliziert
   *  (kanonische Basiszeile gewinnt bei reload), abzüglich entfernter; sortiert. */
  const children = useMemo(() => {
    if (!me) return [];
    const byId = new Map<string, FamilyLink>();
    for (const link of overlay.added) byId.set(link.guardianshipId, link);
    for (const link of childrenOf(me.id, guardianships, members)) byId.set(link.guardianshipId, link);
    return [...byId.values()]
      .filter((link) => !overlay.removedIds.has(link.guardianshipId))
      .sort((a, b) => fullName(a.member).localeCompare(fullName(b.member), "de"));
  }, [me, guardianships, members, overlay]);

  const guardians = useMemo(() => {
    if (!me) return [];
    return guardiansOf(me.id, guardianships, members).sort((a, b) =>
      fullName(a.member).localeCompare(fullName(b.member), "de"),
    );
  }, [me, guardianships, members]);

  /**
   * Verknüpfbare Kandidaten: vereinsverwaltete Mitglieder (Rolle „member") OHNE
   * eigenen Zugang (kein E-Mail-Konto), die noch nicht mein Kind und nicht ich
   * selbst sind. Der Server erzwingt die genaue Regel (unclaimed managed
   * children) endgültig — dies ist nur die plausible Vorauswahl.
   */
  const linkCandidates = useMemo(() => {
    if (!me) return [];
    const linkedIds = new Set(children.map((link) => link.member.id));
    return members.filter(
      (m) => m.role === "member" && !m.email && m.id !== me.id && !linkedIds.has(m.id),
    );
  }, [me, members, children]);

  const partial = teams === null || invoices === null;

  /**
   * Der Mahn-/Beitragsstatus ist der FINANZstand einer Person — er gehört
   * NICHT vor die Augen eines normalen Mitglieds, das hier fremde Personen
   * (etwa das eigene Elternteil) sieht. Deshalb erscheint die Ampel nur ab
   * `finance:read_all` (Kassenwart/Vorstand); `read_own`/`none` fallen darunter
   * und sehen nur Namen, Verhältnis und Teams. Die Verknüpfung selbst bleibt.
   * Durchgesetzt wird das ohnehin serverseitig — das hier verhindert das Leck
   * in der Anzeige.
   */
  const canSeeDues = hasCap("finance", "read_all");
  const duesFor = (link: FamilyLink): DuesStatus | null =>
    canSeeDues && invoices ? duesStatus(link.member, invoices, guardianships) : null;

  const headerActions = (
    <div className="flex flex-wrap gap-2.5">
      <Button variant="ghost" icon="link" onClick={() => setShowLink(true)}>
        {t("linkChildCta")}
      </Button>
      <Button icon="plus" onClick={() => setShowCreate(true)}>
        {t("createChildCta")}
      </Button>
    </div>
  );

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (children.length === 0 && guardians.length === 0) {
    body = (
      <EmptyState
        icon="members"
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button variant="ghost" icon="link" onClick={() => setShowLink(true)}>
              {t("linkChildCta")}
            </Button>
            <Button icon="plus" onClick={() => setShowCreate(true)}>
              {t("createChildCta")}
            </Button>
          </div>
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-6">
        {children.length > 0 && (
          <FamilySection title={t("childrenTitle")} count={children.length}>
            {children.map((link) => (
              <ChildCard
                key={link.guardianshipId}
                link={link}
                subtitle={
                  link.member.birthDate
                    ? t("bornYear", { year: new Date(link.member.birthDate).getFullYear() })
                    : t(RELATION_KEY[link.relation])
                }
                dues={duesFor(link)}
                teams={teams}
                onRemove={setToRemove}
              />
            ))}
          </FamilySection>
        )}

        {guardians.length > 0 && (
          <FamilySection title={t("guardiansTitle")} count={guardians.length}>
            {guardians.map((link) => (
              <PersonCard
                key={link.guardianshipId}
                link={link}
                subtitle={t(RELATION_KEY[link.relation])}
                dues={duesFor(link)}
                teams={teams}
              />
            ))}
          </FamilySection>
        )}

        <div className="grid gap-1">
          {partial && <p className="text-caption text-ink-faint">{t("partialHint")}</p>}
          <p className="text-caption text-ink-faint">{t("selfserviceHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={
          state.status === "ready" && (children.length > 0 || guardians.length > 0)
            ? headerActions
            : undefined
        }
      />
      {body}

      {showCreate && (
        <CreateChildDialog onCreated={onCreated} onClose={() => setShowCreate(false)} />
      )}
      {showLink && (
        <LinkChildSheet
          candidates={linkCandidates}
          onLinked={onLinked}
          onClose={() => setShowLink(false)}
        />
      )}
      <RemoveGuardianshipDialog
        link={toRemove}
        onRemoved={onRemoved}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}
