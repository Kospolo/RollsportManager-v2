"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/data";
import type { UpdatePlatformSmtpInput } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { PlatformSmtpSettings } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { einstellungenDict } from "./i18n";
import type { PanelProps } from "./shared";

/**
 * E-Mail/SMTP-Tab. Host/Port/User/Absender + SSL-Schalter; das Passwort ist
 * WRITE-ONLY (separates Feld, Platzhalter „unverändert lassen“) — wird nie
 * geladen, sondern nur gesetzt, wenn wirklich etwas eingegeben wurde. Der
 * hinterlegte Zustand kommt aus settings.smtp.passwordSet (nie der Klartext).
 */

interface SmtpDraft {
  host: string;
  port: string;
  user: string;
  from: string;
  secure: boolean;
}

function toDraft(smtp: PlatformSmtpSettings): SmtpDraft {
  return {
    host: smtp.host,
    port: smtp.port !== undefined ? String(smtp.port) : "",
    user: smtp.user,
    from: smtp.from,
    secure: smtp.secure,
  };
}

export function SmtpPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const [draft, setDraft] = useState<SmtpDraft>(() => toDraft(settings.smtp));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SmtpDraft>(key: K, value: SmtpDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const portTrim = draft.port.trim();
  const portValue = portTrim === "" ? undefined : Number(portTrim);
  const portInvalid =
    portTrim !== "" &&
    (!Number.isInteger(portValue) || (portValue as number) < 1 || (portValue as number) > 65535);

  const base = settings.smtp;
  const dirty =
    draft.host !== base.host ||
    portValue !== base.port ||
    draft.user !== base.user ||
    draft.from !== base.from ||
    draft.secure !== base.secure ||
    password.length > 0;

  const onSave = async () => {
    if (saving || portInvalid || !dirty) return;
    setSaving(true);
    const smtp: UpdatePlatformSmtpInput = {
      host: draft.host,
      user: draft.user,
      from: draft.from,
      secure: draft.secure,
    };
    if (portValue !== undefined) smtp.port = portValue;
    if (password.length > 0) smtp.password = password; // WRITE-ONLY: nur wenn gesetzt.
    try {
      const updated = await applyPatch({ smtp });
      setDraft(toDraft(updated.smtp));
      setPassword("");
      showToast(t("savedToast"), { tone: savedTone });
    } catch (err) {
      showToast(errorMessage(err), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void onSave(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader eyebrow={t("smtpEyebrow")} title={t("smtpTitle")} />
      <p className="-mt-2 mb-5 max-w-prose text-caption text-ink-faint">{t("smtpDesc")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("fieldHost")}
          value={draft.host}
          onChange={(e) => set("host", e.target.value)}
          placeholder="smtp.example.com"
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fieldPort")}
          value={draft.port}
          onChange={(e) => set("port", e.target.value)}
          inputMode="numeric"
          placeholder="465"
          error={portInvalid ? t("portError") : undefined}
        />
        <Input
          label={t("fieldUser")}
          value={draft.user}
          onChange={(e) => set("user", e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fieldFrom")}
          value={draft.from}
          onChange={(e) => set("from", e.target.value)}
          placeholder="Name <noreply@example.com>"
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fieldPassword")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          hint={t("passwordHint")}
          autoComplete="new-password"
        />
        <div className="grid content-start gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fieldSecure")}</span>
          <div className="flex min-h-11 items-center">
            <Switch
              label={t("fieldSecure")}
              checked={draft.secure}
              onChange={(v) => set("secure", v)}
              words={{ on: t("secureOn"), off: t("secureOff") }}
            />
          </div>
          <p className="text-caption text-ink-faint">{t("secureDesc")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Badge
          tone={settings.smtp.passwordSet ? "success" : "neutral"}
          icon={settings.smtp.passwordSet ? "check" : "lock"}
        >
          {settings.smtp.passwordSet ? t("passwordSet") : t("passwordUnset")}
        </Badge>
        <Button
          onClick={() => void onSave()}
          disabled={saving || !dirty || portInvalid}
          icon="check"
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </Card>
  );
}
