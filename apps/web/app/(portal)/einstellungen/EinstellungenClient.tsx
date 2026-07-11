"use client";

import { useState, type ReactNode } from "react";
import { data, errorMessage, permissions } from "@/lib/data";
import type { UpdateMyPreferencesInput } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { NotificationPrefs, UserPreferences } from "@/lib/types";
import { LOCALES, useLocale, useT, type Locale } from "@/lib/i18n";
import { THEME_MODES, useTheme, type ThemeMode } from "@/lib/theme";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon, type IconName } from "@/components/shell/icons";
import { einstellungenDict } from "./i18n";

/**
 * Persönliche Einstellungen (Benutzermenü → „Einstellungen"). Rein private
 * Präferenzen der eingeloggten Person:
 *   (a) Darstellung — Sprache (DE/EN) + Theme (Hell/Auto/Dunkel). Schreibt in
 *       die eigenen Präferenzen UND spiegelt sofort die App-weiten i18n/theme-
 *       Contexts (kein Neuladen, kein Flash).
 *   (b) Benachrichtigungen — vier Schalter (Termine, Rechnungen, Neuigkeiten,
 *       Chat) in preferences.notifications; steuert die Glocke der Topbar. Der
 *       Server merged partiell → ein Teilobjekt pro Umschaltung genügt.
 *   (c) Vereins-Admins zusätzlich ein Verweis auf /verwaltung/verein.
 *
 * user_preferences sind strikt privat (profile_id = auth.uid, serverseitig
 * erzwungen). Der Admin-Verweis wird — wie die Verwaltungs-Navigation
 * (useVisibleNavItems) — allein anhand isClubAdmin eingeblendet; der echte
 * Schutz der Zielseite bleibt serverseitig.
 */
export function EinstellungenClient() {
  const t = useT(einstellungenDict);
  const state = useData((repo) =>
    Promise.all([repo.getMyPreferences(), repo.getCurrentUser()] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <Skeleton className="h-9 w-56" />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <EmptyState
          icon="settings"
          title={t("loadErrorTitle")}
          body={errorMessage(state.error)}
          action={<Button onClick={state.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  const [prefs, currentUser] = state.data;
  const isClubAdmin = permissions(currentUser).isClubAdmin;

  return <SettingsView prefs={prefs} isClubAdmin={isClubAdmin} />;
}

/* ------------------------------------------------------------------ */

function SettingsView({
  prefs,
  isClubAdmin,
}: {
  prefs: UserPreferences;
  isClubAdmin: boolean;
}) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const { mode, setMode } = useTheme();
  const { locale, setLocale } = useLocale();

  // Benachrichtigungs-Flags leben nur serverseitig (keine App-weite Context) —
  // lokaler Spiegel für sofortiges Feedback, aus der Server-Antwort reconciled.
  const [notif, setNotif] = useState<NotificationPrefs>(() => prefs.notifications);

  /** Präferenz persistieren; App-weit ist bereits gespiegelt (Theme/Locale). */
  const persist = async (patch: UpdateMyPreferencesInput) => {
    try {
      await data.updateMyPreferences(patch);
    } catch {
      showToast(t("syncErrorToast"), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void persist(patch),
      });
    }
  };

  const chooseLocale = (next: Locale) => {
    if (next === locale) return;
    setLocale(next); // App-weit sofort (localStorage + <html lang>)
    void persist({ locale: next });
  };

  const chooseTheme = (next: ThemeMode) => {
    if (next === mode) return;
    setMode(next); // App-weit sofort (localStorage + data-theme, kein Flash)
    void persist({ theme: next });
  };

  const toggleNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    setNotif((n) => ({ ...n, [key]: value })); // optimistisch
    try {
      const updated = await data.updateMyPreferences({ notifications: { [key]: value } });
      setNotif(updated.notifications); // Server-Merge übernehmen
    } catch {
      setNotif((n) => ({ ...n, [key]: !value })); // Rollback
      showToast(t("syncErrorToast"), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void toggleNotif(key, value),
      });
    }
  };

  const localeOptions: SegmentOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: l === "de" ? t("langDe") : t("langEn"),
  }));

  const themeOptions: SegmentOption<ThemeMode>[] = THEME_MODES.map((m) => ({
    value: m,
    label: t(THEME_LABEL_KEY[m]),
    icon: THEME_ICON[m],
  }));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <SectionHeader level={1} title={t("title")} sub={t("sub")} />

      {/* (a) Darstellung — Sprache + Theme */}
      <Card>
        <CardHeader eyebrow={t("appearanceEyebrow")} title={t("appearanceTitle")} />
        <div className="grid">
          <SettingRow label={t("languageLabel")} desc={t("languageDesc")}>
            <Segmented
              label={t("languageLabel")}
              value={locale}
              options={localeOptions}
              onSelect={chooseLocale}
            />
          </SettingRow>
          <SettingRow label={t("themeLabel")} desc={t("themeDesc")}>
            <Segmented
              label={t("themeLabel")}
              value={mode}
              options={themeOptions}
              onSelect={chooseTheme}
            />
          </SettingRow>
        </div>
      </Card>

      {/* (b) Benachrichtigungen — Glocke der Topbar */}
      <Card>
        <CardHeader eyebrow={t("notifyEyebrow")} title={t("notifyTitle")} />
        <div className="grid gap-1">
          <NotifyRow
            label={t("notifyEvents")}
            desc={t("notifyEventsDesc")}
            checked={notif.events ?? false}
            onChange={(v) => void toggleNotif("events", v)}
          />
          <NotifyRow
            label={t("notifyInvoices")}
            desc={t("notifyInvoicesDesc")}
            checked={notif.invoices ?? false}
            onChange={(v) => void toggleNotif("invoices", v)}
          />
          <NotifyRow
            label={t("notifyNews")}
            desc={t("notifyNewsDesc")}
            checked={notif.news ?? false}
            onChange={(v) => void toggleNotif("news", v)}
          />
          <NotifyRow
            label={t("notifyChat")}
            desc={t("notifyChatDesc")}
            checked={notif.chat ?? false}
            onChange={(v) => void toggleNotif("chat", v)}
          />
        </div>
        <p className="mt-4 text-caption text-ink-faint">{t("notifyHint")}</p>
      </Card>

      {/* (c) Verweis für Vereins-Admins */}
      {isClubAdmin && (
        <Card>
          <CardHeader eyebrow={t("adminEyebrow")} title={t("adminTitle")} />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="max-w-md text-caption text-ink-faint">{t("adminDesc")}</p>
            <ButtonLink variant="secondary" icon="shield" href="/verwaltung/verein">
              {t("adminCta")}
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const THEME_ICON: Record<ThemeMode, IconName> = {
  light: "sun",
  auto: "monitor",
  dark: "moon",
};

const THEME_LABEL_KEY = {
  light: "themeLight",
  auto: "themeAuto",
  dark: "themeDark",
} as const;

type SegmentOption<T extends string> = { value: T; label: string; icon?: IconName };

/** Segment-Umschalter (Pille auf bg-sunken) — aktives Segment auf Surface. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onSelect: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-0.5 rounded-full border border-line bg-sunken p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={active}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors duration-150 ${
              active
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(60,32,16,.14)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {option.icon && <Icon name={option.icon} className="ic h-[16px] w-[16px]" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Zeile „Label + Beschreibung ↔ Steuerung" (Hairline-getrennt). */
function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="grid min-w-0 max-w-md gap-0.5">
        <span className="text-[14px] font-bold text-ink">{label}</span>
        <span className="text-caption text-ink-faint">{desc}</span>
      </div>
      {children}
    </div>
  );
}

/** Benachrichtigungs-Zeile mit Switch (Wortlabel Aktiv/Aus). */
function NotifyRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0">
      <div className="grid min-w-0 max-w-md gap-0.5">
        <span className="text-[14px] font-bold text-ink">{label}</span>
        <span className="text-caption text-ink-faint">{desc}</span>
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
