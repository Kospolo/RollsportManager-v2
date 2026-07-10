"use client";

import { useT } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { rollenDict } from "./i18n";
import { PermissionMatrix } from "./PermissionMatrix";
import { RoleAssignment } from "./RoleAssignment";

/**
 * „Rollen & Rechte" (Verwaltung): (a) Rechte-Matrix aus ORIGINAL-APP-REFERENZ
 * 1.3, (b) Rollen-Zuweisung mit Hierarchie-Gating über die Facade, (c) Hinweis
 * auf die serverseitige Durchsetzung. Nur Anzeige — die Wahrheit ist der Server.
 */

/** (c) Kurzer, ruhiger Hinweis: Rechte gelten serverseitig (Referenz 1.5). */
function ServerNote() {
  const t = useT(rollenDict);
  return (
    <Card className="flex items-start gap-3">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name="lock" className="ic h-4 w-4" />
      </span>
      <span className="grid gap-1">
        <span className="eyebrow">{t("serverEyebrow")}</span>
        <span className="font-display text-h3 tracking-[-0.01em] text-ink">{t("serverTitle")}</span>
        <p className="text-[14px] text-ink-soft">{t("serverBody")}</p>
      </span>
    </Card>
  );
}

export function RollenClient() {
  const t = useT(rollenDict);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <SectionHeader level={1} title={t("title")} sub={t("sub")} />
      <PermissionMatrix />
      <RoleAssignment />
      <ServerNote />
    </div>
  );
}
