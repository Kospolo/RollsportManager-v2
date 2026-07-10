"use client";

import { useT } from "@/lib/i18n";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { rollenDict, roleLabelKey, roleDescKey, type RollenKey } from "./i18n";
import {
  CAPABILITIES,
  ROLE_ORDER,
  ROLE_TONE,
  capState,
  type Capability,
  type CapState,
} from "./derive";

/**
 * Rechte-Matrix (ORIGINAL-APP-REFERENZ 1.3) als lesbare Tabelle:
 * Rollen (Zeilen) × Fähigkeiten (Spalten), ✓ / – / eingeschränkt.
 * Reine Anzeige — die Durchsetzung passiert serverseitig.
 */

const CAP_HEADER: Record<Capability, RollenKey> = {
  trainer: "capTrainer",
  clubAdmin: "capClubAdmin",
  members: "capMembers",
  finance: "capFinance",
  changeRole: "capChangeRole",
};

/** Fußnoten-Marker je (Rolle, Fähigkeit) — „†" Gasttrainer, „*" Moderation. */
function footnoteMark(role: string, capability: Capability): string | null {
  if (capability === "trainer" && role === "guest_coach") return "†";
  if (capability === "changeRole" && role === "moderator") return "*";
  return null;
}

function CapCell({
  state,
  mark,
  labels,
}: {
  state: CapState;
  mark: string | null;
  labels: { yes: string; no: string; partial: string };
}) {
  if (state === "yes") {
    return (
      <span className="inline-flex items-center justify-center">
        <Icon name="check" className="ic h-4 w-4 text-success" />
        <span className="sr-only">{labels.yes}</span>
      </span>
    );
  }
  if (state === "partial") {
    return (
      <span className="inline-flex items-baseline justify-center gap-0.5 text-warn">
        <Icon name="check" className="ic h-4 w-4 self-center" />
        {mark && <span aria-hidden="true" className="text-[11px] font-bold">{mark}</span>}
        <span className="sr-only">
          {labels.partial}
          {mark ? ` (${mark})` : ""}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-ink-faint">
      <span aria-hidden="true">–</span>
      <span className="sr-only">{labels.no}</span>
    </span>
  );
}

export function PermissionMatrix() {
  const t = useT(rollenDict);
  const capLabels = { yes: t("aYes"), no: t("aNo"), partial: t("aPartial") };

  return (
    <Card padded={false}>
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <CardHeader eyebrow={t("matrixEyebrow")} title={t("matrixTitle")} />
      </div>
      <div className="overflow-x-auto px-5 sm:px-6">
        <table className="w-full border-separate border-spacing-0">
          <caption className="sr-only">{t("matrixCaption")}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-line px-3 pb-2 pt-1 text-left text-[11px] font-extrabold uppercase tracking-[.08em] text-ink-faint"
              >
                {t("colRole")}
              </th>
              {CAPABILITIES.map((capability) => (
                <th
                  key={capability}
                  scope="col"
                  className="border-b border-line px-3 pb-2 pt-1 text-center text-[11px] font-extrabold uppercase tracking-[.08em] text-ink-faint"
                >
                  {t(CAP_HEADER[capability])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {ROLE_ORDER.map((role) => (
              <tr key={role} className="h-14">
                <th
                  scope="row"
                  className="border-b border-line px-3 py-3 text-left align-middle font-normal"
                >
                  <span className="grid gap-0.5">
                    <StatusPill tone={ROLE_TONE[role]} className="w-fit">
                      {t(roleLabelKey(role))}
                    </StatusPill>
                    <span className="text-[12px] text-ink-faint">{t(roleDescKey(role))}</span>
                  </span>
                </th>
                {CAPABILITIES.map((capability) => (
                  <td
                    key={capability}
                    className="border-b border-line px-3 py-3 text-center align-middle"
                  >
                    <CapCell
                      state={capState(role, capability)}
                      mark={footnoteMark(role, capability)}
                      labels={capLabels}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardFooter className="mx-5 sm:mx-6">
        <span className="grid gap-1">
          <span>
            <span className="font-bold text-warn">*</span> {t("fnModerator")}
          </span>
          <span>
            <span className="font-bold text-warn">†</span> {t("fnGuest")}
          </span>
          <span className="flex items-start gap-1.5 pt-1">
            <Icon name="lock" className="ic mt-0.5 h-3.5 w-3.5 flex-none text-ink-faint" />
            {t("platformNote")}
          </span>
        </span>
      </CardFooter>
    </Card>
  );
}
