"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { ApiError, errorMessage } from "@/lib/data";
import { apiClient } from "@/lib/data/api/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { profilDict } from "../i18n";

/**
 * Konto-Löschung (Apple 5.1.1(v) / DSGVO Art. 17) — der Nutzer löscht sein
 * EIGENES Konto über DELETE /me (apiClient.deleteMe). Bewusst api-only: im
 * mock-Modus (öffentliche Beta ohne echten Login) wird diese Karte gar nicht
 * eingehängt (siehe ProfilScreen), damit die Demo nichts „löscht".
 *
 * Zwei Schutzstufen gegen ein Versehen, KEIN Auto-Confirm:
 *  1. der destruktive Knopf öffnet nur den Dialog,
 *  2. im Dialog muss die Person aktiv eine Pflicht-Bestätigung ankreuzen, bevor
 *     der endgültige Danger-Knopf klickbar wird.
 *
 * 200 → Session lokal löschen (signOut) und auf /login umleiten.
 * 409 → die Person ist alleinige aktive Inhaberin eines Vereins; der Server
 *   liefert die betroffenen Vereinsnamen als bilingualen Klartext (problem.detail).
 *   Der bleibt als Fehler im Dialog stehen, die Person bleibt eingeloggt.
 */
export function DeleteAccountCard() {
  const t = useT(profilDict);
  const router = useRouter();
  const { signOut } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blockedDetail, setBlockedDetail] = useState<string | null>(null);

  function openDialog() {
    setAcknowledged(false);
    setBlockedDetail(null);
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
  }

  async function confirmDelete() {
    if (submitting || !acknowledged) return;
    setSubmitting(true);
    setBlockedDetail(null);
    try {
      await apiClient.deleteMe();
      // Erst nach dem bestätigten 200: Session lokal räumen und raus.
      showToast(t("deleteSuccessToast"), { tone: "success" });
      signOut();
      router.push("/login");
    } catch (error) {
      // 409 = alleinige aktive Inhaberin eines Vereins. Der Server nennt die
      // Vereinsnamen im bilingualen detail — den zeigen wir wörtlich, die Person
      // bleibt eingeloggt und kann erst die Inhaberschaft übertragen.
      if (error instanceof ApiError && error.status === 409) {
        setBlockedDetail(error.problem?.detail ?? t("deleteBlockedFallback"));
      } else {
        showToast(errorMessage(error), { tone: "danger" });
      }
      setSubmitting(false);
    }
  }

  return (
    <Card className="ring-1 ring-inset ring-danger/25">
      <CardHeader eyebrow={t("deleteEyebrow")} title={t("deleteTitle")} />
      <p className="text-[14px] leading-[21px] text-ink-soft">{t("deleteBody")}</p>
      <div className="mt-4 flex justify-start">
        <Button variant="danger" icon="trash" onClick={openDialog}>
          {t("deleteButton")}
        </Button>
      </div>

      <Modal
        open={open}
        onClose={closeDialog}
        eyebrow={t("deleteEyebrow")}
        title={t("deleteDialogTitle")}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>
              {t("deleteCancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmDelete()}
              disabled={submitting || !acknowledged}
            >
              {submitting ? t("deleteDeleting") : t("deleteConfirm")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="text-body text-ink-soft">{t("deleteDialogBody")}</p>

          {/* Pflicht-Bestätigung: der endgültige Knopf bleibt gesperrt, solange
              dies nicht aktiv angekreuzt ist — nie ein Auto-Confirm. */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-sunken p-3.5 transition-colors duration-150 ${
              acknowledged ? "border-danger ring-1 ring-danger" : "border-line hover:border-ink-faint"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={acknowledged}
              disabled={submitting}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span
              aria-hidden
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border ${
                acknowledged ? "border-danger bg-danger text-canvas" : "border-line bg-canvas"
              }`}
            >
              {acknowledged && <Icon name="check" className="ic h-3.5 w-3.5" />}
            </span>
            <span className="text-[14px] leading-snug text-ink">{t("deleteAcknowledge")}</span>
          </label>

          {blockedDetail && (
            <div
              role="alert"
              className="grid gap-1 rounded-xl border border-danger/40 bg-danger/10 p-3.5"
            >
              <span className="flex items-center gap-2 text-[13px] font-bold text-danger">
                <Icon name="zap" className="ic h-4 w-4" />
                {t("deleteBlockedTitle")}
              </span>
              <p className="text-[14px] leading-snug text-ink">{blockedDetail}</p>
            </div>
          )}
        </div>
      </Modal>
    </Card>
  );
}
