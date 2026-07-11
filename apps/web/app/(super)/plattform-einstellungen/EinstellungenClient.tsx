"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { data, dataSource, errorMessage, permissions } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { PlatformSettings } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { einstellungenDict } from "./i18n";
import { SmtpPanel } from "./SmtpPanel";
import { LegalPanel, ContentPanel } from "./TextPanels";
import { FlagsPanel } from "./FlagsPanel";
import type { ApplyPatch, PanelProps } from "./shared";

/**
 * Plattform-Einstellungen (Betreiber-Ebene): E-Mail/SMTP, Rechtstexte,
 * Website & SEO und Feature-Flags — gepflegt im Admin-UI (nicht in .env). Lesen
 * über data.platformGetSettings, Schreiben (Deep-Merge) über
 * data.platformUpdateSettings → GET/PATCH /platform/settings, serverseitig
 * hinter requirePlatformAdmin bzw. RLS. Das SMTP-Passwort ist WRITE-ONLY und
 * wird nie im Klartext geladen (nur passwordSet).
 *
 * Sichtbarkeit im Client anhand permissions().isPlatformAdmin (Token-Claim
 * app_metadata.is_platform_admin) — reine UX, der Server bleibt die alleinige
 * Autorität. Im mock-Modus als Demo freigeschaltet. Gleiches Zugriffsmuster wie
 * die übrigen (super)-Ansichten.
 */

type Access = "checking" | "granted" | "denied";

/** Zugriff aus dem Token-Claim ableiten — externer Store, kein setState-Effect. */
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

export function EinstellungenClient() {
  const t = useT(einstellungenDict);
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

  return <SettingsLoader />;
}

/* ------------------------------------------------------------------ */

function SettingsLoader() {
  const t = useT(einstellungenDict);
  const state = useData((repo) => repo.platformGetSettings());

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  }

  return <SettingsWorkbench initial={state.data} />;
}

/* ------------------------------------------------------------------ */

type TabValue = "smtp" | "legal" | "content" | "flags";

const ID_BASE = "platform-settings";

function SettingsWorkbench({ initial }: { initial: PlatformSettings }) {
  const t = useT(einstellungenDict);
  const { locale } = useLocale();
  const [settings, setSettings] = useState<PlatformSettings>(initial);
  const [tab, setTab] = useState<TabValue>("smtp");

  // Ein Teil-Patch pro Tab; die Server-Antwort (vollständig, maskiert) wird zur
  // neuen Wahrheit — so bleiben passwordSet/updatedAt und alle Tabs synchron.
  const applyPatch = useCallback<ApplyPatch>(async (patch) => {
    const updated = await data.platformUpdateSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  const savedTone = dataSource === "api" ? "success" : "info";
  const panelProps: PanelProps = { settings, applyPatch, savedTone };

  const tabs: TabItem<TabValue>[] = [
    { value: "smtp", label: t("tabSmtp") },
    { value: "legal", label: t("tabLegal") },
    { value: "content", label: t("tabContent") },
    { value: "flags", label: t("tabFlags") },
  ];

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label={t("tabsLabel")} idBase={ID_BASE} />
        <span className="text-caption text-ink-faint">
          {t("lastUpdated", { date: formatDateTime(settings.updatedAt, locale) })}
        </span>
      </div>

      <TabPanel value="smtp" active={tab} idBase={ID_BASE}>
        <SmtpPanel {...panelProps} />
      </TabPanel>
      <TabPanel value="legal" active={tab} idBase={ID_BASE}>
        <LegalPanel {...panelProps} />
      </TabPanel>
      <TabPanel value="content" active={tab} idBase={ID_BASE}>
        <ContentPanel {...panelProps} />
      </TabPanel>
      <TabPanel value="flags" active={tab} idBase={ID_BASE}>
        <FlagsPanel {...panelProps} />
      </TabPanel>
    </div>
  );
}
