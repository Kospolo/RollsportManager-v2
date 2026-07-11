"use client";

import { useState } from "react";
import {
  ApiError,
  data,
  dataSource,
  errorMessage,
  isForbidden,
  type SetEntitlementInput,
} from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import type {
  PlatformEntitlement,
  PlatformEntitlementStatus,
  PlatformTier,
} from "@/lib/types";
import { lizenzenDict } from "./i18n";
import {
  STATUS_LABEL_KEY,
  STATUS_OPTIONS,
  TIER_LABEL_KEY,
  TIER_OPTIONS,
} from "./derive";

/**
 * Lizenz eines Vereins setzen/ändern (Stufe, Status, Testphase) über
 * data.platformSetEntitlement → PATCH /platform/entitlements/{clubId}. Der
 * Server ist die Wahrheit: 409 (illegaler Übergang), 422 (unbekanntes Produkt)
 * und 403 (keine Berechtigung) werden als Klartext gezeigt. Jede Änderung setzt
 * die Quelle auf „manuell“ und wird im Audit-Log protokolliert (Hinweis im UI).
 */

function isoToDateInput(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/** yyyy-mm-dd → ISO am Tagesende (UTC), damit „gültig bis“ den ganzen Tag deckt. */
function dateInputToIso(value: string): string {
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export function EditEntitlementModal({
  entitlement,
  onClose,
  onSaved,
}: {
  /** Zu bearbeitende Zeile; null = geschlossen. */
  entitlement: PlatformEntitlement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(lizenzenDict);
  const { showToast } = useToast();

  const [tier, setTier] = useState<PlatformTier>(entitlement?.tier ?? "basic");
  const [status, setStatus] = useState<PlatformEntitlementStatus>(
    entitlement?.status ?? "trial",
  );
  const [validUntil, setValidUntil] = useState(isoToDateInput(entitlement?.validUntil));
  const [trialDays, setTrialDays] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);

  if (!entitlement) return null;

  const isCreate = !entitlement.entitlementId;
  const showTrialDays = status === "trial";

  function mapError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 409) return t("err409");
      if (err.status === 422) return t("err422");
      if (err.status === 403) return t("err403");
    }
    return errorMessage(err);
  }

  async function submit() {
    if (!entitlement || saving) return;
    setError(null);
    setTrialError(null);

    const input: SetEntitlementInput = { tier, status };
    const trimmedReason = reason.trim();
    if (trimmedReason) input.reason = trimmedReason;

    const useTrial = showTrialDays && trialDays.trim() !== "";
    if (useTrial) {
      const parsed = Number(trialDays);
      if (!Number.isInteger(parsed) || parsed < 1) {
        setTrialError(t("fieldTrialDaysError"));
        return;
      }
      input.trialDays = parsed;
    } else {
      // Kein Testtage-Wert → „Gültig bis“ aus dem Datumsfeld (leer = unbefristet).
      input.validUntil = validUntil ? dateInputToIso(validUntil) : null;
    }

    setSaving(true);
    try {
      await data.platformSetEntitlement(entitlement.clubId, input);
      showToast(
        t("savedToast", { club: entitlement.clubName }),
        { tone: dataSource === "api" ? "success" : "info" },
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(isForbidden(err) ? t("forbiddenToast") : mapError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`${t("modalEyebrow")} · ${entitlement.clubName}`}
      title={isCreate ? t("modalTitleCreate") : t("modalTitleManage")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving} icon="check">
            {saving ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fieldTier")}
            value={tier}
            onChange={(e) => setTier(e.target.value as PlatformTier)}
          >
            {TIER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(TIER_LABEL_KEY[value])}
              </option>
            ))}
          </Select>

          <Select
            label={t("fieldStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as PlatformEntitlementStatus)}
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(STATUS_LABEL_KEY[value])}
              </option>
            ))}
          </Select>
        </div>

        <Input
          type="date"
          label={t("fieldValidUntil")}
          hint={t("fieldValidUntilHint")}
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />

        {showTrialDays && (
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            label={t("fieldTrialDays")}
            hint={t("fieldTrialDaysHint")}
            error={trialError ?? undefined}
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        )}

        <Textarea
          label={t("fieldReason")}
          hint={t("fieldReasonHint")}
          placeholder={t("reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />

        {status === "canceled" && (
          <div className="flex items-start gap-2.5 rounded-lg bg-warn-soft px-4 py-3 text-warn">
            <Icon name="zap" className="ic mt-0.5 h-4 w-4 flex-none" />
            <span className="grid gap-0.5">
              <span className="text-[13.5px] font-bold">{t("cancelWarnTitle")}</span>
              <span className="text-[13px]">{t("cancelWarnBody")}</span>
            </span>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-info">
          <Icon name="lock" className="ic mt-0.5 h-4 w-4 flex-none" />
          <span className="grid gap-0.5">
            <span className="text-[13.5px] font-bold">{t("auditTitle")}</span>
            <span className="text-[13px]">{t("auditBody")}</span>
          </span>
        </div>

        {error && (
          <p role="alert" className="text-caption font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
