"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import {
  data,
  errorMessage,
  isForbidden,
  DISCIPLINE_MAX,
  MOTTO_MAX,
  SKATING_SINCE_MIN,
  type UpdateMySelfProfileInput,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { MySelfProfile, ProfileVisibility } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { profilDict } from "../i18n";

const FORM_ID = "profil-self-form";
const SKATING_SINCE_MAX = new Date().getFullYear() + 1;

/**
 * Selbst-Profil-Karte des eigenen Profils (0045/0053) — das freiwillige,
 * selbst gepflegte Gegenstück zu den vereinsverwalteten Stammdaten. Schreibt
 * über die Facade updateMySelfProfile → PATCH /clubs/{clubId}/members/{memberId}
 * /profile (app.set_self_profile, die EINE Wahrheit): nur die Person selbst darf,
 * nur status=active, Kontaktdaten-Leitplanke + Längen serverseitig. Die
 * Sichtbarkeit ('public'|'internal') setzt hier nur den Wert — durchgesetzt wird
 * sie serverseitig (redactSelfProfile). Vorgabe: 'internal' (fail-safe).
 */
export function SelfProfileCard() {
  const t = useT(profilDict);
  const self = useData((repo) => repo.getMySelfProfile());

  if (self.status === "loading") {
    return (
      <Card>
        <CardHeader eyebrow={t("selfEyebrow")} title={t("selfTitle")} />
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-2/3 rounded-md" />
        </div>
      </Card>
    );
  }

  if (self.status === "error") {
    return (
      <Card>
        <CardHeader eyebrow={t("selfEyebrow")} title={t("selfTitle")} />
        <EmptyState
          icon="zap"
          title={t("selfLoadErrorTitle")}
          body={errorMessage(self.error)}
          action={
            <Button variant="secondary" onClick={self.reload}>
              {t("loadErrorRetry")}
            </Button>
          }
        />
      </Card>
    );
  }

  // null = Plattform-Persona ohne Vereinsmitgliedschaft — dann gibt es kein
  // Selbst-Profil (die Karte wird in ProfilScreen ohnehin nur mit Mitgliedschaft
  // eingehängt; dies ist die defensive Absicherung).
  if (!self.data) return null;

  return (
    <SelfProfileForm
      key={signatureOf(self.data)}
      initial={self.data}
      onSaved={self.reload}
    />
  );
}

/** Stabiler Remount-Schlüssel: nach dem Speichern reseedt das Formular sauber. */
function signatureOf(p: MySelfProfile): string {
  return [p.motto ?? "", p.favoriteDiscipline ?? "", p.skatingSince ?? "", p.visibility].join("|");
}

function SelfProfileForm({
  initial,
  onSaved,
}: {
  initial: MySelfProfile;
  onSaved: () => void;
}) {
  const t = useT(profilDict);
  const { showToast } = useToast();

  const original = useMemo(
    () => ({
      motto: initial.motto ?? "",
      discipline: initial.favoriteDiscipline ?? "",
      skating: initial.skatingSince != null ? String(initial.skatingSince) : "",
      visibility: initial.visibility,
    }),
    [initial],
  );

  const [motto, setMotto] = useState(original.motto);
  const [discipline, setDiscipline] = useState(original.discipline);
  const [skating, setSkating] = useState(original.skating);
  const [visibility, setVisibility] = useState<ProfileVisibility>(original.visibility);
  const [skatingError, setSkatingError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const mottoTrim = motto.trim();
  const disciplineTrim = discipline.trim();
  const skatingTrim = skating.trim();

  const mottoTooLong = mottoTrim.length > MOTTO_MAX;
  const disciplineTooLong = disciplineTrim.length > DISCIPLINE_MAX;
  const mottoRemaining = MOTTO_MAX - mottoTrim.length;

  const patch = useMemo<UpdateMySelfProfileInput>(() => {
    const next: UpdateMySelfProfileInput = {};
    if (mottoTrim !== original.motto.trim()) next.motto = mottoTrim === "" ? null : mottoTrim;
    if (disciplineTrim !== original.discipline.trim())
      next.favoriteDiscipline = disciplineTrim === "" ? null : disciplineTrim;
    if (skatingTrim !== original.skating.trim())
      next.skatingSince = skatingTrim === "" ? null : Number(skatingTrim);
    if (visibility !== original.visibility) next.visibility = visibility;
    return next;
  }, [mottoTrim, disciplineTrim, skatingTrim, visibility, original]);

  const dirty = Object.keys(patch).length > 0;
  const blocked = mottoTooLong || disciplineTooLong;

  function reset() {
    setMotto(original.motto);
    setDiscipline(original.discipline);
    setSkating(original.skating);
    setVisibility(original.visibility);
    setSkatingError(undefined);
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting || blocked) return;

    // Jahr validieren (nur wenn angegeben). Server prüft es ebenfalls; hier die
    // freundliche Vorab-Meldung statt eines 422.
    if (skatingTrim !== "") {
      const year = Number(skatingTrim);
      const valid =
        Number.isInteger(year) && year >= SKATING_SINCE_MIN && year <= SKATING_SINCE_MAX;
      if (!valid) {
        setSkatingError(t("errSkating", { min: SKATING_SINCE_MIN, max: SKATING_SINCE_MAX }));
        return;
      }
    }
    setSkatingError(undefined);

    if (!dirty) {
      showToast(t("noChanges"), { tone: "neutral" });
      return;
    }

    setSubmitting(true);
    try {
      await data.updateMySelfProfile(patch);
      showToast(t("selfSavedToast"), { tone: "success" });
      onSaved();
    } catch (error) {
      // 403 = nicht berechtigt (der Eigentümer darf immer sein eigenes; ein
      // 403 wäre z. B. ein Verwalter, der ein fremdes zu schreiben versucht).
      // Alles andere — inkl. der serverseitigen Kontaktdaten-Leitplanke (422) —
      // kommt als ehrlicher Server-Klartext zurück.
      showToast(isForbidden(error) ? t("selfNoPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("loadErrorRetry"),
        onAction: () => void handleSubmit(formEvent),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader eyebrow={t("selfEyebrow")} title={t("selfTitle")} />
      <p className="mb-4 text-[13px] text-ink-soft">{t("selfIntro")}</p>

      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <Textarea
            label={t("fMotto")}
            placeholder={t("fMottoPh")}
            hint={t("fMottoHint")}
            error={mottoTooLong ? t("fMottoTooLong", { max: MOTTO_MAX }) : undefined}
            value={motto}
            rows={4}
            maxLength={MOTTO_MAX + 40}
            onChange={(event) => setMotto(event.target.value)}
          />
          <p
            aria-live="polite"
            className={`text-right text-caption tabular-nums ${
              mottoTooLong ? "text-danger" : "text-ink-faint"
            }`}
          >
            {t("fMottoRemaining", { n: mottoRemaining })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fDiscipline")}
            placeholder={t("fDisciplinePh")}
            error={disciplineTooLong ? t("fDisciplineTooLong", { max: DISCIPLINE_MAX }) : undefined}
            value={discipline}
            maxLength={DISCIPLINE_MAX + 20}
            onChange={(event) => setDiscipline(event.target.value)}
          />
          <Input
            label={t("fSkating")}
            type="number"
            inputMode="numeric"
            placeholder={t("fSkatingPh")}
            hint={t("fSkatingHint")}
            error={skatingError}
            value={skating}
            min={SKATING_SINCE_MIN}
            max={SKATING_SINCE_MAX}
            onChange={(event) => {
              setSkating(event.target.value);
              setSkatingError(undefined);
            }}
          />
        </div>

        <VisibilityChoice value={visibility} onChange={setVisibility} />

        <div className="mt-1 flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={reset} disabled={submitting || !dirty}>
            {t("reset")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon="check"
            disabled={submitting || !dirty || blocked}
          >
            {t("selfSave")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Sichtbarkeits-Auswahl als echtes Radiogroup — zwei ehrlich beschriftete
 * Kacheln (was WIRKLICH passiert, nicht „an/aus"). Vorgabe 'internal'.
 */
function VisibilityChoice({
  value,
  onChange,
}: {
  value: ProfileVisibility;
  onChange: (next: ProfileVisibility) => void;
}) {
  const t = useT(profilDict);
  const options: {
    key: ProfileVisibility;
    icon: "globe" | "lock";
    title: string;
    desc: string;
  }[] = [
    { key: "public", icon: "globe", title: t("visPublicTitle"), desc: t("visPublicDesc") },
    { key: "internal", icon: "lock", title: t("visInternalTitle"), desc: t("visInternalDesc") },
  ];

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-[13px] font-bold text-ink">{t("visLegend")}</legend>
      <div role="radiogroup" aria-label={t("visLegend")} className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <label
              key={option.key}
              className={`relative flex cursor-pointer gap-3 rounded-xl border bg-sunken p-3.5 transition-colors duration-150 ${
                selected
                  ? "border-brand ring-1 ring-brand"
                  : "border-line hover:border-ink-faint"
              }`}
            >
              <input
                type="radio"
                name="self-visibility"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(option.key)}
              />
              <span
                aria-hidden
                className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg ${
                  selected ? "bg-brand/15 text-brand" : "bg-canvas text-ink-soft"
                }`}
              >
                <Icon name={option.icon} className="ic h-4 w-4" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
                  {option.title}
                  {selected && <Icon name="check" className="ic h-3.5 w-3.5 text-brand" />}
                </span>
                <span className="text-caption leading-snug text-ink-soft">{option.desc}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
