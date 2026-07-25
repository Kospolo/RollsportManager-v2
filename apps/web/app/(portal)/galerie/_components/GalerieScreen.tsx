"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage, isClubModuleDisabled, isClubProRequired, isNotImplemented, memberById, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import { useT } from "@/lib/i18n";
import type { GalleryItem, Id, Member } from "@/lib/types";
import { galerieDict } from "../i18n";
import { GalleryGrid } from "./GalleryGrid";
import { GalleryLightbox } from "./GalleryLightbox";
import { UploadGalleryDialog } from "./UploadGalleryDialog";
import { DeleteGalleryDialog } from "./DeleteGalleryDialog";
import { ProUpgradeCard } from "./ProUpgradeCard";
import { ModuleNotBookedCard } from "@/components/ui/ModuleNotBookedCard";

/** Stabiler Leer-Fallback, solange die Facade lädt (kein useMemo-Flackern). */
const NO_ITEMS: GalleryItem[] = [];
/** Sentinel für den „Ohne Album"-Filter. */
const NO_ALBUM = "__none__";

/**
 * Galerie-Screen (Fotos & Videos, PRO). Lädt zuerst das Entitlement — nur bei
 * aktivem PRO wird die Liste geladen (sonst 402). Ohne PRO erscheint die
 * Upgrade-Karte statt der Inhalte; das Gate ist verbindlich serverseitig
 * (auch ein 402 aus listGallery landet dank isClubProRequired auf der Karte).
 * Trainer+ (mit PRO) sehen Upload/Löschen — die Sichtbarkeit ist kosmetisch,
 * durchgesetzt wird per RLS + Entitlement (403/402 → Toast). Nach jedem
 * Schreiben lädt der Screen neu.
 *
 * Wer Upload/Löschen sieht, entscheidet die aufgelöste Fähigkeit
 * `hasCap("gallery", "edit")` (Vorstand/Trainer:in ja, einfaches Mitglied
 * fällt auf read_all/none und sieht nur die Ansicht). Das ist Kosmetik; der
 * Server bleibt die verbindliche Grenze.
 */
export function GalerieScreen() {
  const t = useT(galerieDict);
  const { hasCap } = useCapabilities();

  const core = useData(async (repo) => {
    const [entitlement, currentUser, members] = await Promise.all([
      repo.getClubEntitlement(),
      repo.getCurrentUser(),
      repo.getMembers(),
    ]);
    const items = entitlement.pro ? await repo.listGallery() : NO_ITEMS;
    return { entitlement, currentUser, members, items };
  });

  const [openId, setOpenId] = useState<Id | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null);
  const [album, setAlbum] = useState("");

  const entitlement = core.status === "ready" ? core.data.entitlement : null;
  const currentUser = core.status === "ready" ? core.data.currentUser : null;
  const members: Member[] = core.status === "ready" ? core.data.members : [];
  const items = core.status === "ready" ? core.data.items : NO_ITEMS;

  const isPro = entitlement?.pro ?? false;
  const perms = permissions(currentUser);
  // Upload/Löschen nur mit PRO UND der Schreib-Fähigkeit auf der Galerie.
  // Ein einfaches Mitglied (gallery = read_all/none) fällt hier auf false und
  // sieht die Galerie nur an; Vorstand (owner → rank 5) und Trainer:innen
  // (gallery = edit) behalten die Controls. Server bleibt die harte Grenze.
  const canWrite = isPro && hasCap("gallery", "edit");
  // Markieren = Staff (Trainer/Vorstand/Moderator, OHNE Kassenwart) — deckt sich
  // mit COACH_ROLES der API (photo-tags.ts). Nur Sichtbarkeit; der Server (403)
  // ist die verbindliche Grenze. isTrainer schließt treasurer bereits aus.
  const canTag = perms.isTrainer;

  const { options, effectiveAlbum, filtered } = useMemo(() => {
    const albums = Array.from(
      new Set(items.filter((i) => i.album).map((i) => i.album as string)),
    );
    const hasNoAlbum = items.some((i) => !i.album);

    const opts: FilterChipOption<string>[] = [
      { value: "", label: t("allAlbums"), count: items.length },
      ...albums.map((a) => ({
        value: a,
        label: a,
        count: items.filter((i) => i.album === a).length,
      })),
      ...(hasNoAlbum
        ? [{ value: NO_ALBUM, label: t("noAlbum"), count: items.filter((i) => !i.album).length }]
        : []),
    ];

    // Filter zurücksetzen, falls das gewählte Album nach einem Reload weg ist.
    const eff = opts.some((o) => o.value === album) ? album : "";
    const list =
      eff === ""
        ? items
        : eff === NO_ALBUM
          ? items.filter((i) => !i.album)
          : items.filter((i) => i.album === eff);

    return { options: opts, effectiveAlbum: eff, filtered: list };
  }, [items, album, t]);

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {t("pageTitle")}
          <Badge tone="brand" icon="lock">
            {t("proBadge")}
          </Badge>
        </span>
      }
      sub={t("pageSub")}
      action={
        canWrite ? (
          <Button icon="plus" disabled={core.status !== "ready"} onClick={() => setUploadOpen(true)}>
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
          <ProUpgradeCard tier="free" />
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // PRO-Gate: kein aktives Entitlement → Upgrade-Karte statt Inhalten.
  if (!isPro) {
    return (
      <div className="grid content-start gap-6">
        {header}
        <ProUpgradeCard tier={entitlement?.tier ?? "free"} />
      </div>
    );
  }

  const openItem = openId ? (items.find((i) => i.id === openId) ?? null) : null;
  const openAuthor = openItem ? memberById(members, openItem.uploadedByMemberId) : undefined;
  const showChips = options.length > 2;

  return (
    <div className="grid content-start gap-6">
      {header}

      {items.length === 0 ? (
        <EmptyState
          icon="sparkle"
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
        <>
          {showChips && (
            <FilterChips
              options={options}
              value={effectiveAlbum}
              onChange={setAlbum}
              label={t("filterLabel")}
            />
          )}
          <GalleryGrid
            items={filtered}
            canWrite={canWrite}
            onOpen={setOpenId}
            onDelete={setDeleteTarget}
          />
        </>
      )}

      {openItem && (
        <GalleryLightbox
          item={openItem}
          author={openAuthor}
          members={members}
          canTag={canTag}
          currentMemberId={currentUser?.id ?? null}
          onClose={() => setOpenId(null)}
        />
      )}

      <UploadGalleryDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={core.reload}
      />

      <DeleteGalleryDialog
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={core.reload}
      />
    </div>
  );
}
