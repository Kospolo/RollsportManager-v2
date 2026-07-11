"use client";

import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/shell/icons";
import { profilDict } from "../i18n";

/**
 * Konto-Karte: Anmelde-E-Mail (nur lesend) und ein Hinweis, dass das Passwort
 * ausschließlich über die Anmeldung geändert wird — im Portal ändern wir keine
 * Passwörter (Sicherheit). Rein informativ, keine schreibende Aktion.
 */
export function AccountCard({ email }: { email?: string }) {
  const t = useT(profilDict);

  return (
    <Card>
      <CardHeader eyebrow={t("accountEyebrow")} title={t("accountTitle")} />
      <dl className="grid">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5">
          <dt className="flex items-center gap-2 text-[13px] font-semibold text-ink-faint">
            <Icon name="mail" className="ic h-4 w-4" />
            {t("accountEmailLabel")}
          </dt>
          <dd className="min-w-0 text-[14px] text-ink">
            {email ? (
              <span className="break-all">{email}</span>
            ) : (
              <span className="text-ink-faint">{t("accountNoEmail")}</span>
            )}
          </dd>
        </div>
        <div className="grid gap-1 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <dt className="flex items-center gap-2 text-[13px] font-semibold text-ink-faint">
              <Icon name="lock" className="ic h-4 w-4" />
              {t("passwordLabel")}
            </dt>
            <dd className="text-[14px] font-semibold text-ink-soft">{t("passwordNote")}</dd>
          </div>
          <p className="text-caption text-ink-faint">{t("passwordHint")}</p>
        </div>
      </dl>
    </Card>
  );
}
