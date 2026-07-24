"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  data,
  type ClubModuleState,
  type ModuleVisibilityRow,
  type ModuleVisibilityScope,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { moduleDict } from "./i18n";

/**
 * Verwaltung → Module → SICHTBARKEIT (Migration 0077).
 *
 * ### DIE VIERTE FRAGE ###
 * Auf dieser Seite werden inzwischen zwei verschiedene Dinge eingestellt:
 *   * OBEN  „benutzt der Verein das Modul überhaupt?" (0044, app.club_modules)
 *   * HIER  „wem wird die Kachel im Menü angeboten?"  (0077)
 * Sie hängen als UND zusammen: was der Verein abgeschaltet hat, kann keine
 * Sichtbarkeits-Einstellung ins Menü heben.
 *
 * ### !!! DAS HIER IST KEIN ZUGRIFFSSCHUTZ !!! ###
 * Das steht nicht nur im Code, sondern auch auf dem Bildschirm — und zwar an
 * einer Stelle, die man nicht wegklicken kann. Wer eine Kachel ausblendet,
 * nimmt niemandem ein Recht: über einen Deeplink darf dieselbe Person genau so
 * viel wie vorher. Wer eine Kachel einblendet, gibt kein Recht: die Seite
 * dahinter bleibt leer oder antwortet mit 403.
 * Wer ZUGRIFF steuern will, geht zu „Rollen & Rechte".
 * Diese Ehrlichkeit ist dieselbe Haltung wie bei den Etiketten oben
 * („versteckt nur die Kachel"): eine Sperre vorzutäuschen, die es nicht gibt,
 * ist schlimmer als keine Sperre — man verlässt sich drauf.
 *
 * ### WARUM ES DIE „VORGABE" GIBT UND NICHT NUR AN/AUS ###
 * Jede Rolle hat einen dritten Zustand: „nichts eingestellt". Dann gilt die aus
 * der Rechtematrix ABGELEITETE Vorgabe — und die wandert mit, wenn der Verein
 * die Rechte seiner Rollen ändert. Ein reines An/Aus würde diese Verbindung
 * beim ersten Klick kappen und den Verein zwingen, zwei Listen zu pflegen.
 *
 * ### DIE OBERFLÄCHE SETZT NICHTS DURCH ###
 * Die Schalter sind für Nicht-Admins ausgegraut — Kosmetik. Durchgesetzt wird
 * es serverseitig (RLS auf app.module_visibility); ein 403 ist eine normale
 * Antwort und landet als Toast.
 */

/** Der dritte Zustand ist kein Zufall, sondern die Vorgabe — siehe Kopf. */
type Choice = "default" | "on" | "off";

const choiceOf = (override: boolean | null): Choice =>
  override === null ? "default" : override ? "on" : "off";

const valueOf = (choice: Choice): boolean | null =>
  choice === "default" ? null : choice === "on";

export function ModuleVisibility({
  modules,
  isClubAdmin,
}: {
  modules: readonly ClubModuleState[];
  isClubAdmin: boolean;
}) {
  const t = useT(moduleDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const matrix = useData((repo) => repo.listModuleVisibility());
  const roles = useData((repo) => repo.listClubRoles());
  const departments = useData((repo) => repo.listDepartments());
  const members = useData((repo) => repo.getMembers());

  const [rows, setRows] = useState<ModuleVisibilityRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  /** Welches Modul wird gerade eingestellt. Alle 25 gleichzeitig wären ein Rasen. */
  const [moduleKey, setModuleKey] = useState<string>("");

  useEffect(() => {
    if (matrix.status === "ready") setRows(matrix.data);
  }, [matrix.status, matrix.data]);

  /**
   * Einstellbar sind alle Module AUSSER der Verwaltung: sie nimmt serverseitig
   * keine Zeile an (sonst gäbe es keinen Weg zurück, 0077). Ein Schalter, der
   * immer mit 409 scheitert, gehört nicht auf den Bildschirm.
   */
  const configurable = useMemo(
    () => modules.filter((m) => m.moduleKey !== "manage").sort((a, b) => a.sort - b.sort),
    [modules],
  );

  useEffect(() => {
    if (moduleKey === "" && configurable.length > 0) {
      setModuleKey(configurable[0]!.moduleKey);
    }
  }, [moduleKey, configurable]);

  const label = useCallback(
    (m: ClubModuleState) => (locale === "en" ? m.labelEn : m.labelDe),
    [locale],
  );

  const current = configurable.find((m) => m.moduleKey === moduleKey);
  const forModule = rows.filter((r) => r.moduleKey === moduleKey);
  const roleRows = forModule.filter((r) => r.scope === "role");
  const departmentRows = forModule.filter((r) => r.scope === "department");
  const memberRows = forModule.filter((r) => r.scope === "member");

  const save = useCallback(
    async (scope: ModuleVisibilityScope, targetId: string, targetLabel: string, choice: Choice) => {
      const key = `${scope}:${targetId}`;
      setBusy(key);
      try {
        const saved = await data.setModuleVisibility(moduleKey, {
          scope,
          targetId,
          visible: valueOf(choice),
        });
        // Den WIRKLICHEN Zustand des Servers übernehmen, nicht den erhofften:
        // die Vorgabe kann sich geändert haben, während jemand an den Rollen
        // gearbeitet hat.
        setRows((all) => [...all.filter((r) => r.moduleKey !== moduleKey), ...saved]);
        showToast(t("visSaved", { title: targetLabel }), { tone: "success" });
      } catch {
        showToast(t("visSaveFailed", { title: targetLabel }), { tone: "danger" });
        void matrix.reload();
      } finally {
        setBusy(null);
      }
    },
    [moduleKey, showToast, t, matrix],
  );

  if (matrix.status === "loading") {
    return <Skeleton className="h-40" />;
  }
  if (matrix.status === "error") {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-[13px] text-ink-faint">
        {t("visLoadFailed")}{" "}
        <Button variant="secondary" onClick={matrix.reload}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  /** Ein Ziel + seine drei Möglichkeiten. Ein Zeilenbaustein für alle Ebenen. */
  function TargetRow({
    scope,
    targetId,
    targetLabel,
    override,
    defaultVisible,
  }: {
    scope: ModuleVisibilityScope;
    targetId: string;
    targetLabel: string;
    override: boolean | null;
    defaultVisible: boolean | null;
  }) {
    const choice = choiceOf(override);
    const disabled = !isClubAdmin || busy === `${scope}:${targetId}`;
    const options: readonly { value: Choice; text: string }[] = [
      { value: "default", text: t("visChoiceDefault") },
      { value: "on", text: t("visChoiceOn") },
      { value: "off", text: t("visChoiceOff") },
    ];

    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="text-[14px] font-bold text-ink">{targetLabel}</b>
          {defaultVisible !== null && (
            <span className="text-[12.5px] text-ink-faint">
              {defaultVisible ? t("visDefaultShown") : t("visDefaultHidden")}
            </span>
          )}
        </span>
        {override === null && defaultVisible !== null && (
          <Badge tone="neutral">{t("visBadgeDefault")}</Badge>
        )}
        <span
          role="radiogroup"
          aria-label={t("visChoiceLabel", { title: targetLabel })}
          className="inline-flex overflow-hidden rounded-lg border border-line"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={choice === o.value}
              disabled={disabled}
              onClick={() => void save(scope, targetId, targetLabel, o.value)}
              className={`px-3 py-1.5 text-[12.5px] font-bold transition-colors disabled:opacity-50 ${
                choice === o.value
                  ? "bg-brand-soft text-brand-ink"
                  : "bg-surface text-ink-soft hover:bg-sunken"
              }`}
            >
              {o.text}
            </button>
          ))}
        </span>
      </div>
    );
  }

  /** „Ausnahme hinzufügen" für Gruppen und Mitglieder. */
  function AddException({
    scope,
    choices,
    labelText,
  }: {
    scope: ModuleVisibilityScope;
    choices: readonly { id: string; name: string }[];
    labelText: string;
  }) {
    const used = new Set(forModule.filter((r) => r.scope === scope).map((r) => r.targetId));
    const free = choices.filter((c) => !used.has(c.id));
    if (!isClubAdmin || free.length === 0) return null;
    return (
      <Select
        label={labelText}
        value=""
        onChange={(e) => {
          const id = e.currentTarget.value;
          if (id === "") return;
          const name = free.find((c) => c.id === id)?.name ?? id;
          // Eine neue Ausnahme startet als „sichtbar" — das ist der Fall, für
          // den man sie überhaupt anlegt („dieses Elternteil darf zusätzlich…").
          // Auf „Aus" stellt man sie mit einem Klick daneben.
          void save(scope, id, name, "on");
        }}
      >
        <option value="">{t("visAddPlaceholder")}</option>
        {free.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("visTitle")} sub={t("visSub")} />

      {/* Die Warnung, die man nicht wegklicken kann — siehe Kopf. */}
      <p className="rounded-xl border border-warn/40 bg-warn-soft px-5 py-4 text-[13px] leading-snug text-ink">
        <b>{t("visNotSecurityTitle")}</b> {t("visNotSecurityBody")}
      </p>

      <Select
        label={t("visModulePicker")}
        value={moduleKey}
        onChange={(e) => setModuleKey(e.currentTarget.value)}
      >
        {configurable.map((m) => (
          <option key={m.moduleKey} value={m.moduleKey}>
            {label(m)}
          </option>
        ))}
      </Select>

      {/* Ein abgeschaltetes Modul ist für niemanden sichtbar — das muss
          dranstehen, sonst stellt jemand hier lange etwas ein, das nie wirkt. */}
      {current && !current.available && (
        <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-[13px] text-ink-faint">
          {t("visModuleOff")}
        </p>
      )}

      {/* ---------------- Rollen: die Basis ---------------- */}
      <div className="grid gap-2">
        <SectionHeader level={2} title={t("visRoles")} sub={t("visRolesSub")} />
        {roleRows
          .slice()
          .sort((a, b) => a.targetLabel.localeCompare(b.targetLabel, locale))
          .map((r) => (
            <TargetRow
              key={r.targetId}
              scope="role"
              targetId={r.targetId}
              targetLabel={
                roles.status === "ready"
                  ? (roles.data.find((x) => x.id === r.targetId)?.[
                      locale === "en" ? "nameEn" : "nameDe"
                    ] ?? r.targetLabel)
                  : r.targetLabel
              }
              override={r.override}
              defaultVisible={r.defaultVisible}
            />
          ))}
      </div>

      {/* ---------------- Gruppen (Abteilungen) ---------------- */}
      <div className="grid gap-2">
        <SectionHeader level={2} title={t("visGroups")} sub={t("visGroupsSub")} />
        {departmentRows.length === 0 && (
          <p className="text-[13px] text-ink-faint">{t("visNoException")}</p>
        )}
        {departmentRows.map((r) => (
          <TargetRow
            key={r.targetId}
            scope="department"
            targetId={r.targetId}
            targetLabel={r.targetLabel}
            override={r.override}
            defaultVisible={null}
          />
        ))}
        <AddException
          scope="department"
          labelText={t("visAddGroup")}
          choices={
            departments.status === "ready"
              ? departments.data.map((d) => ({ id: d.id, name: d.name }))
              : []
          }
        />
      </div>

      {/* ---------------- Einzelne Mitglieder ---------------- */}
      <div className="grid gap-2">
        <SectionHeader level={2} title={t("visMembers")} sub={t("visMembersSub")} />
        {memberRows.length === 0 && (
          <p className="text-[13px] text-ink-faint">{t("visNoException")}</p>
        )}
        {memberRows.map((r) => (
          <TargetRow
            key={r.targetId}
            scope="member"
            targetId={r.targetId}
            targetLabel={r.targetLabel}
            override={r.override}
            defaultVisible={null}
          />
        ))}
        <AddException
          scope="member"
          labelText={t("visAddMember")}
          choices={
            members.status === "ready"
              ? members.data.map((m) => ({
                  id: m.id,
                  name: `${m.firstName} ${m.lastName}`,
                }))
              : []
          }
        />
      </div>
    </section>
  );
}
