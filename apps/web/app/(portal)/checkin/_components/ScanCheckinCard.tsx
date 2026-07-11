"use client";

import { useCallback, useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Event, Id, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { parseMemberQr } from "@/lib/member-qr";
import { checkinDict } from "../i18n";
import { EventSelect } from "./EventSelect";
import { qrScanSupported, useQrScanner } from "./useQrScanner";

/**
 * Check-in-Station (nur Trainer:innen): scannt den „Mein QR-Code" eines
 * Mitglieds live über die Kamera (BarcodeDetector) und checkt es ein
 * (data.createCheckin, method 'qr'). Fehlt die Kamera-API, bleibt die manuelle
 * Eingabe des Codes/der Mitglieds-ID. Ein gescannter Fremd-QR trifft auf kein
 * Vereinsmitglied → klare Ablehnung. Rechte bleiben serverseitig (403 → Toast).
 */
export function ScanCheckinCard({
  members,
  events,
  now,
  onCheckedIn,
}: {
  members: Member[];
  events: Event[];
  now: Date;
  onCheckedIn: () => void;
}) {
  const t = useT(checkinDict);
  const { showToast } = useToast();

  const supported = useMemo(() => qrScanSupported(), []);
  const byId = useMemo(() => new Map<Id, Member>(members.map((m) => [m.id, m])), [members]);

  const [eventId, setEventId] = useState<string>("");
  const [manual, setManual] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);

  const checkIn = useCallback(
    async (raw: string) => {
      if (busy) return;
      const memberId = parseMemberQr(raw);
      const member = memberId ? byId.get(memberId as Id) : undefined;
      if (!member) {
        setLast({ ok: false, text: t("scanUnknown") });
        showToast(t("scanUnknown"), { tone: "danger" });
        return;
      }
      setBusy(true);
      try {
        await data.createCheckin({ memberId: member.id, eventId: eventId || undefined, method: "qr" });
        const done = t("scanCheckedIn", { name: fullName(member) });
        setLast({ ok: true, text: done });
        showToast(done, { tone: "success" });
        onCheckedIn();
      } catch (caught) {
        const message = isForbidden(caught) ? t("forbidden") : errorMessage(caught);
        setLast({ ok: false, text: message });
        showToast(message, { tone: "danger" });
      } finally {
        setBusy(false);
      }
    },
    [busy, byId, eventId, onCheckedIn, showToast, t],
  );

  const { state: scanState, errorKind, videoRef, start, stop } = useQrScanner(checkIn);

  const submitManual = () => {
    const value = manual.trim();
    if (!value || busy) return;
    setManual("");
    void checkIn(value);
  };

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("scanTitle")} sub={t("scanSub")} />

      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <EventSelect value={eventId} onChange={setEventId} events={events} now={now} />

        {supported ? (
          <div className="grid gap-3">
            {/* Kamerabild: dunkel-auf-hell egal, hier bewusst neutrales Sunken. */}
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-line bg-ink">
              <video
                ref={videoRef}
                aria-label={t("scanCameraLabel")}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              {scanState !== "scanning" && (
                <div className="absolute inset-0 grid place-items-center bg-sunken text-center">
                  <Icon name="search" className="ic h-8 w-8 text-ink-faint" />
                </div>
              )}
              {scanState === "scanning" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/80"
                />
              )}
            </div>

            <div className="flex items-center justify-center">
              {scanState === "scanning" ? (
                <Button variant="secondary" icon="close" onClick={stop}>
                  {t("scanStop")}
                </Button>
              ) : (
                <Button icon="play" onClick={start} disabled={scanState === "starting"}>
                  {t("scanStart")}
                </Button>
              )}
            </div>

            <p className="text-center text-caption text-ink-faint">
              {scanState === "scanning" ? t("scanActiveHint") : t("scanIdleHint")}
            </p>

            {errorKind && (
              <p className="text-center text-caption font-semibold text-danger">
                {errorKind === "permission" ? t("scanPermission") : t("scanCameraError")}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-sunken px-3 py-2.5 text-caption text-ink-soft">
            {t("scanUnsupported")}
          </p>
        )}

        {/* Manuelle Eingabe (Fallback ohne Kamera & Notlösung an der Station). */}
        <div className="grid gap-2 border-t border-line pt-4">
          <Input
            label={t("scanManualLabel")}
            hint={t("scanManualHint")}
            placeholder={t("scanManualPlaceholder")}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitManual();
              }
            }}
          />
          <div className="flex justify-end">
            <Button icon="check" onClick={submitManual} disabled={busy || manual.trim() === ""}>
              {t("scanManualCta")}
            </Button>
          </div>
        </div>

        {last && (
          <p
            className={`text-caption font-semibold ${last.ok ? "text-success" : "text-danger"}`}
            role="status"
          >
            {last.text}
          </p>
        )}
      </div>
    </section>
  );
}
