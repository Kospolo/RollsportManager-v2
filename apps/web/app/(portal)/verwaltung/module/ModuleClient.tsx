"use client";

import { useCallback, useEffect, useState } from "react";
import { data, permissions, type ClubModuleState } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { moduleDict } from "./i18n";
import { ModuleVisibility } from "./ModuleVisibility";

/**
 * Verwaltung → Module (Migration 0044): welche Bereiche benutzt der Verein?
 *
 * ### DIE DREI FRAGEN — HIER WIRD NUR EINE BEANTWORTET ###
 *   gekauft (Entitlement) -> EINGESCHALTET (hier) -> erlaubt (Rollen & Rechte)
 * Wer darf was, steht unter Verwaltung → Rollen. Diese Seite sagt nur, OB der
 * Verein ein Modul überhaupt hat.
 *
 * ### WARUM DIE ETIKETTEN ###
 * Nicht jeder Schalter wirkt gleich weit (app.modules.enforcement, 0044). Ein
 * Schalter, der nur die Kachel versteckt, wird hier auch so beschriftet
 * („versteckt nur die Kachel") statt „Aus" zu behaupten. Dasselbe Muster wie
 * bei den Rechten (0033) und aus demselben Grund: eine Sperre vorzutäuschen,
 * die es nicht gibt, ist schlimmer als keine Sperre — man verlässt sich drauf.
 *
 * ### DIE OBERFLÄCHE SETZT NICHTS DURCH ###
 * Der Schalter ist für Nicht-Admins ausgegraut — das ist Kosmetik. Durchgesetzt
 * wird es serverseitig (RLS auf app.club_modules); ein 403 ist eine normale
 * Antwort und landet als Toast, nicht als Absturz. Ebenso der Kernmodul-Schutz:
 * hier steht gar kein Schalter, der Server würde ihn mit 409 abweisen.
 */

/** Optimistischer Zustand je Modul, solange der Server noch antwortet. */
type Pending = Record<string, boolean | undefined>;

export function ModuleClient() {
  const t = useT(moduleDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const modules = useData((repo) => repo.listClubModules());
  const me = useData((repo) => repo.getCurrentUser());
  const isClubAdmin = permissions(me.data ?? null).isClubAdmin;

  /** Die Liste des Servers, lokal gespiegelt — damit der Schalter sofort reagiert. */
  const [rows, setRows] = useState<ClubModuleState[]>([]);
  const [pending, setPending] = useState<Pending>({});

  useEffect(() => {
    if (modules.status === "ready") setRows(modules.data);
  }, [modules.status, modules.data]);

  const label = useCallback(
    (m: ClubModuleState) => (locale === "en" ? m.labelEn : m.labelDe),
    [locale],
  );
  const desc = useCallback(
    (m: ClubModuleState) => (locale === "en" ? m.descEn : m.descDe),
    [locale],
  );

  const toggle = useCallback(
    async (m: ClubModuleState, next: boolean) => {
      setPending((p) => ({ ...p, [m.moduleKey]: true }));
      // Optimistisch umlegen — bei Fehler unten zurückgerollt.
      setRows((current) =>
        current.map((r) =>
          r.moduleKey === m.moduleKey
            ? { ...r, enabled: next, available: next && r.proOk }
            : r,
        ),
      );
      try {
        const saved = await data.setClubModuleEnabled(m.moduleKey, next);
        // Den WIRKLICHEN Zustand des Servers übernehmen, nicht den erhofften:
        // bei einem PRO-Modul ohne Lizenz bleibt available false.
        setRows((current) =>
          current.map((r) => (r.moduleKey === saved.moduleKey ? saved : r)),
        );
        showToast(t(next ? "savedOn" : "savedOff", { title: label(m) }), { tone: "success" });
      } catch {
        // Rollback: der Schalter zeigt wieder den echten Stand.
        setRows((current) =>
          current.map((r) =>
            r.moduleKey === m.moduleKey
              ? { ...r, enabled: m.enabled, available: m.available }
              : r,
          ),
        );
        showToast(t("saveFailed", { title: label(m) }), {
          tone: "danger",
          actionLabel: t("retry"),
          onAction: () => void toggle(m, next),
        });
      } finally {
        setPending((p) => ({ ...p, [m.moduleKey]: undefined }));
      }
    },
    [label, t, showToast],
  );

  if (modules.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (modules.status === "error") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <EmptyState
          icon="shield"
          title={t("loadFailed")}
          body={t("loadFailedBody")}
          action={
            <Button variant="secondary" onClick={modules.reload}>
              {t("retry")}
            </Button>
          }
        />
      </div>
    );
  }

  const switchable = rows.filter((m) => !m.core);
  const core = rows.filter((m) => m.core);

  /** Die ehrliche Fussnote zur Wirkung — oder nichts, wenn der Schalter wirkt. */
  function hintFor(m: ClubModuleState): string | null {
    if (m.requiresPro && !m.proOk) return t("hintProMissing");
    // Zubuchbar und noch nicht gebucht: der Grund ist keine fehlende Lizenz,
    // sondern eine ausstehende Buchung — anderer Satz, anderer Ausweg (0068).
    if (m.defaultEnabled === false && !m.enabled) return t("hintBookable");
    // Finanzen (0061): ehrlicher Hinweis, dass Abschalten NICHTS loescht — die
    // Aufbewahrung sichern die Kassenbuch-Trigger, der Schalter verbirgt nur.
    if (m.moduleKey === "finance") return t("hintFinanceRetention");
    if (m.enforcement === "menu_only") return t("hintMenuOnly");
    if (m.enforcement === "partial") return t("hintPartial");
    return null;
  }

  function coreHintFor(m: ClubModuleState): string {
    if (m.moduleKey === "finance") return t("hintCoreFinance");
    if (m.moduleKey === "manage") return t("hintCoreManage");
    return t("hintCoreMembers");
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-7">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />

      {!isClubAdmin && (
        <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-[13px] text-ink-faint">
          {t("readOnlyNote")}
        </p>
      )}

      {/* ---------------- Abschaltbare Module ---------------- */}
      <section className="grid gap-3">
        <SectionHeader level={2} title={t("sectionSwitchable")} sub={t("sectionSwitchableSub")} />
        <div className="grid gap-3">
          {switchable.map((m) => {
            const hint = hintFor(m);
            return (
              <div
                key={m.moduleKey}
                className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                      {label(m)}
                    </b>
                    {m.requiresPro && <Badge tone="warn">{t("badgePro")}</Badge>}
                    {/* Zubuchbar (0068): der Verein hat es NICHT von Haus aus. */}
                    {m.defaultEnabled === false && (
                      <Badge tone="neutral">{t("badgeBookable")}</Badge>
                    )}
                    {/* Die ehrlichen Etiketten — nur wo der Schalter NICHT voll wirkt. */}
                    {m.enforcement === "menu_only" && (
                      <Badge tone="neutral">{t("badgeMenuOnly")}</Badge>
                    )}
                    {m.enforcement === "partial" && (
                      <Badge tone="neutral">{t("badgePartial")}</Badge>
                    )}
                  </span>
                  <span className="text-[13px] leading-snug text-ink-soft">{desc(m)}</span>
                  {hint && (
                    <span className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">{hint}</span>
                  )}
                </span>
                <Switch
                  checked={m.enabled}
                  onChange={(next) => void toggle(m, next)}
                  label={t("switchLabel", { title: label(m) })}
                  words={{ on: t("on"), off: t("off") }}
                  disabled={!isClubAdmin || pending[m.moduleKey] === true}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Kernmodule: kein Schalter ---------------- */}
      <section className="grid gap-3">
        <SectionHeader level={2} title={t("sectionCore")} sub={t("sectionCoreSub")} />
        <div className="grid gap-3">
          {core.map((m) => (
            <div
              key={m.moduleKey}
              className="flex items-center gap-4 rounded-xl border border-dashed border-line bg-surface p-5"
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink-soft">
                    {label(m)}
                  </b>
                  <Badge tone="neutral">{t("badgeCore")}</Badge>
                </span>
                <span className="text-[13px] leading-snug text-ink-soft">{desc(m)}</span>
                <span className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">
                  {coreHintFor(m)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Sichtbarkeit (0077) ----------------
          Die VIERTE Frage, und die einzige, die von der Person abhängt statt
          vom Verein: „wem wird die Kachel angeboten?" Sie steht bewusst UNTER
          den Schaltern — was der Verein gar nicht benutzt, muss man auch
          niemandem zeigen oder verbergen. Und sie ist ausdrücklich KEIN
          Zugriffsschutz; das sagt die Karte im Abschnitt selbst. */}
      <ModuleVisibility modules={rows} isClubAdmin={isClubAdmin} />
    </div>
  );
}
