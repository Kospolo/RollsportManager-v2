"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import {
  errorMessage,
  isClubModuleDisabled,
  isClubProRequired,
  isNotImplemented,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import { useT } from "@/lib/i18n";
import type { DocumentItem, Member } from "@/lib/types";
import { documentsDict } from "../i18n";
import { DocumentsTable } from "./DocumentsTable";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import { ProUpgradeCard } from "./ProUpgradeCard";
import { ModuleNotBookedCard } from "@/components/ui/ModuleNotBookedCard";

/** Stabiler Leer-Fallback, solange die Facade lädt (kein useMemo-Flackern). */
const NO_DOCS: DocumentItem[] = [];

/**
 * Dokumente-Screen (Dateien & Downloads, PRO). Lädt Entitlement, Mitglieder
 * und — nur bei aktivem PRO — die Dokumentliste über die Facade. Ohne
 * Entitlement (pro:false bzw. HTTP 402 club_pro_required) erscheint statt der
 * Tabelle der Upgrade-Hinweis. Schreibaktionen (Hochladen/Löschen) zeigt der
 * Screen nur, wer die Fähigkeit `documents` mindestens auf Stufe `edit` hat
 * (hasCap → fail-closed: ein reines Mitglied fällt auf 0/none und sieht nur die
 * Lese-Ansicht; der Vereinsinhaber sieht als geschützte Rolle alles). Das ist
 * Kosmetik — die Durchsetzung bleibt serverseitig (RLS + Entitlement), ein
 * 403/402 kommt in den Dialogen als Toast zurück.
 */
export function DocumentsScreen() {
  const t = useT(documentsDict);
  const { hasCap } = useCapabilities();

  const core = useData(async (repo) => {
    const entitlement = await repo.getClubEntitlement();
    const members = await repo.getMembers();
    const documents = entitlement.pro ? await repo.listDocuments() : NO_DOCS;
    return { entitlement, members, documents };
  });

  const [filter, setFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  const ready = core.status === "ready";
  const entitlement = ready ? core.data.entitlement : undefined;
  const documents = ready ? core.data.documents : NO_DOCS;
  const members: Member[] = ready ? core.data.members : [];

  const pro = entitlement?.pro ?? false;
  // Schreib-/Admin-Controls (Hochladen/Löschen) nur ab Stufe `edit` auf der
  // Fähigkeit `documents`. hasCap ist fail-closed: ein reines Mitglied (keine
  // Rolle bzw. nur „member") erreicht 0/none und sieht nur die Lese-Ansicht;
  // der Vereinsinhaber liegt als geschützte Rolle bei rank 5 und sieht alles.
  const canWrite = pro && hasCap("documents", "edit");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [documents]);

  const filterOptions = useMemo(
    () => [
      { value: "all", label: t("filterAll"), count: documents.length },
      ...categories.map(([name, count]) => ({ value: name, label: name, count })),
    ],
    [categories, documents.length, t],
  );

  const filtered = filter === "all" ? documents : documents.filter((d) => d.category === filter);

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={
        <span className="inline-flex items-center gap-2.5">
          {t("pageTitle")}
          <Badge tone="warn">{t("proBadge")}</Badge>
        </span>
      }
      sub={t("pageSub")}
      action={
        canWrite ? (
          <Button icon="plus" disabled={!ready} onClick={() => setUploadOpen(true)}>
            {t("upload")}
          </Button>
        ) : undefined
      }
    />
  );

  if (core.status === "error") {
    return (
      <div className="grid content-start gap-6">
        {header}
        {isClubProRequired(core.error) ? (
          <ProUpgradeCard />
        ) : isClubModuleDisabled(core.error) ? (
          // 403 club_module_disabled: NICHT GEBUCHT, nicht "kaputt" und nicht
          // "leer". Reihenfolge wie in der API: erst Lizenz (402), dann Buchung.
          <ModuleNotBookedCard
          eyebrow={t("notBookedEyebrow")}
          title={t("notBookedTitle")}
          body={t("notBookedBody")}
          hint={t("notBookedHint")}
          badge={t("notBookedBadge")}
        />
        ) : isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={core.reload}>
                {t("loadErrorRetry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (core.status === "loading") {
    return (
      <div className="grid content-start gap-6">
        {header}
        <Skeleton className="h-9 w-64" />
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (!pro) {
    return (
      <div className="grid content-start gap-6">
        {header}
        <ProUpgradeCard entitlement={entitlement} />
      </div>
    );
  }

  return (
    <div className="grid content-start gap-6">
      {header}

      {documents.length === 0 ? (
        <EmptyState
          icon="download"
          title={t("emptyTitle")}
          body={canWrite ? t("emptyBodyTrainer") : t("emptyBodyMember")}
          action={
            canWrite ? (
              <Button icon="plus" onClick={() => setUploadOpen(true)}>
                {t("emptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {categories.length > 1 && (
            <FilterChips
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              label={t("filterLabel")}
            />
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("filteredEmptyTitle")}
              body={t("filteredEmptyBody")}
              action={
                <Button variant="secondary" onClick={() => setFilter("all")}>
                  {t("filterAll")}
                </Button>
              }
            />
          ) : (
            <Card padded={false} className="p-2 sm:p-3">
              <DocumentsTable
                documents={filtered}
                members={members}
                canWrite={canWrite}
                onDelete={setDeleteTarget}
              />
            </Card>
          )}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        categories={categories.map(([name]) => name)}
        onClose={() => setUploadOpen(false)}
        onUploaded={core.reload}
      />

      <DeleteDocumentDialog
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={core.reload}
      />
    </div>
  );
}
