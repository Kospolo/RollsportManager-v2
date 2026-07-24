"use client";

import { useState } from "react";
import { data, errorMessage, fullName, isForbidden, memberById } from "@/lib/data";
import type { Locker, LockerRental, Member } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { schliessfaecherDict, STATUS_ICON, STATUS_KEY, STATUS_TONE } from "../i18n";
import {
  RENTAL_STATUS_KEY,
  RENTAL_STATUS_TONE,
  SIZE_KEY,
  formatIsoDate,
  isPriceNumeric,
  priceLabel,
} from "../derive";

/**
 * Schließfach-Karte: Nummer/Kennung, Standort, Größe, Status-Badge
 * (frei/belegt/defekt), LISTENPREIS und — falls vorhanden — die laufende
 * VERMIETUNG mit dem tatsächlich vereinbarten Preis.
 *
 * ### ZWEI ACHSEN, DIE NICHT DASSELBE SIND ###
 * BELEGUNG (frei/belegt/defekt, assign/release) = wer hat den Schlüssel.
 * VERMIETUNG (aktiv/beendet/gekündigt) = wer zahlt. Der Server koppelt beides
 * NICHT, und diese Karte zeigt sie deshalb als zwei getrennte Blöcke mit
 * eigenen Badges. Ein einziges Wort „belegt" für beides wäre bequemer und
 * würde genau den Fehler erzeugen, den es zu vermeiden gilt: Fach freigegeben,
 * Miete läuft weiter, niemand sieht es.
 *
 * ### PREISE ###
 * Beträge stehen in Mono/tabular (DESIGN-SYSTEM §2.4). Die WORTE „Kein Preis
 * festgelegt" und „Kostenlos" bleiben Fließtext — Mono ist für Zahlen da, ein
 * monospaced Satz sähe aus wie ein Wert. Listenpreis und vereinbarter Preis
 * stehen nebeneinander, ohne dass die Ansicht einen davon zum „richtigen"
 * erklärt: der Vertrag gilt, der Listenpreis ist der Vorschlag von heute.
 *
 * Freigeben und Defekt-/Repariert-Meldung laufen inline über die Facade;
 * Zuordnen/Bearbeiten/Löschen/Vermieten/Beenden öffnen die Dialoge oben. Die
 * Rechte-Wahrheit bleibt serverseitig — ein 403 wird als Toast + Rollback
 * (onChanged → Liste neu laden) behandelt.
 */
export function LockerCard({
  locker,
  rental,
  members,
  personalView = false,
  canManage,
  canAssign,
  canRent,
  onAssign,
  onReassign,
  onEdit,
  onDelete,
  onRent,
  onEditRental,
  onEndRental,
  onChanged,
}: {
  locker: Locker;
  /** Der laufende Vertrag — nur, SOFERN die Betrachterin ihn sehen darf. */
  rental: LockerRental | undefined;
  members: Member[];
  /**
   * Mitglieds-Ansicht: dieselbe Karte, andere ANREDE. „Vermietet an Maja
   * Krüger" ist für die Verwaltung richtig und für Maja selbst befremdlich —
   * sie liest „Deine Miete · Du zahlst". Der eigene Avatar entfällt: ihr das
   * eigene Gesicht zu zeigen ist keine Information.
   */
  personalView?: boolean;
  canManage: boolean;
  canAssign: boolean;
  canRent: boolean;
  onAssign: () => void;
  onReassign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRent: () => void;
  onEditRental: (rental: LockerRental) => void;
  onEndRental: (rental: LockerRental) => void;
  onChanged: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const assignedMember =
    locker.status === "assigned" && locker.assignedMemberId
      ? memberById(members, locker.assignedMemberId)
      : undefined;

  const renter = rental ? memberById(members, rental.memberId) : undefined;

  const run = async (
    action: () => Promise<unknown>,
    successMessage: string,
    forbiddenMessage: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      showToast(successMessage, { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? forbiddenMessage : errorMessage(caught), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const release = () =>
    run(
      () => data.releaseLocker(locker.id),
      t("releasedToast", { label: locker.label }),
      t("forbiddenAssign"),
    );

  const markBroken = () =>
    run(
      () => data.updateLocker(locker.id, { status: "broken", assignedMemberId: null }),
      t("markedBrokenToast", { label: locker.label }),
      t("forbiddenManage"),
    );

  const markRepaired = () =>
    run(
      () => data.updateLocker(locker.id, { status: "free" }),
      t("markedRepairedToast", { label: locker.label }),
      t("forbiddenManage"),
    );

  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 break-words font-mono text-h3 font-bold tracking-[-0.01em] text-ink">
            {locker.label}
          </h3>
          <Badge tone={STATUS_TONE[locker.status]} icon={STATUS_ICON[locker.status]} className="ml-auto">
            {t(STATUS_KEY[locker.status])}
          </Badge>
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="pin" className="ic h-3.5 w-3.5 flex-none text-ink-faint" />
            <span className={locker.location ? "" : "text-ink-faint"}>
              {locker.location || t("noLocation")}
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-faint">
            ·
          </span>
          <span>{t(SIZE_KEY[locker.size])}</span>
        </p>

        {/* LISTENPREIS — der Vorschlag des Vereins, nicht der Vertrag.
            In der Mitglieds-Ansicht entfällt er, SOBALD ein Vertrag läuft: dann
            zählt für Maja, was sie zahlt, und nicht, was das Fach heute kosten
            würde. Die beiden Zahlen nebeneinander laden nur zu der Frage ein,
            warum jemand anderes weniger zahlt. Ohne Vertrag bleibt er stehen —
            dort ist er die Antwort auf „was würde mich das kosten?". */}
        {!(personalView && rental) && (
          <p className="flex items-baseline justify-between gap-3 border-t border-line pt-3 text-caption">
            <span className="text-ink-faint">{t("priceListLabel")}</span>
            <PriceValue cents={locker.pricePerMonthCents} />
          </p>
        )}

        {locker.status === "assigned" && !personalView && (
          <div className="flex items-center gap-2.5 rounded-md bg-sunken px-3 py-2">
            {assignedMember ? (
              <>
                <Avatar
                  personId={assignedMember.id}
                  firstName={assignedMember.firstName}
                  lastName={assignedMember.lastName}
                  size="s"
                />
                <span className="grid min-w-0">
                  <span className="text-caption text-ink-faint">{t("assignedTo")}</span>
                  <span className="truncate text-caption font-semibold text-ink">
                    {fullName(assignedMember)}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-caption text-ink-soft">{t("unknownMember")}</span>
            )}
          </div>
        )}

        {/* VERMIETUNG — eigener Block, eigenes Badge. Drei Fälle:
            1. ich sehe den Vertrag,
            2. es läuft einer, aber die RLS gibt ihn mir nicht,
            3. es läuft keiner. */}
        {rental ? (
          <div className="grid gap-2 rounded-md border border-line bg-sunken/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-caption font-bold uppercase tracking-[0.04em] text-ink-faint">
                {personalView ? t("myRentalTitle") : t("rentalEyebrow")}
              </span>
              <Badge tone={RENTAL_STATUS_TONE[rental.status]} className="ml-auto">
                {t(RENTAL_STATUS_KEY[rental.status])}
              </Badge>
            </div>

            {!personalView && (
              <div className="flex items-center gap-2.5">
                {renter ? (
                  <>
                    <Avatar
                      personId={renter.id}
                      firstName={renter.firstName}
                      lastName={renter.lastName}
                      size="s"
                    />
                    <span className="grid min-w-0">
                      <span className="text-caption text-ink-faint">{t("rentalActiveTo")}</span>
                      <span className="truncate text-caption font-semibold text-ink">
                        {fullName(renter)}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="text-caption text-ink-soft">{t("unknownMember")}</span>
                )}
              </div>
            )}

            <p className="flex items-baseline justify-between gap-3 text-caption">
              <span className="text-ink-faint">
                {personalView ? t("myRentalPrice") : t("rentalAgreed")}
              </span>
              <PriceValue cents={rental.pricePerMonthCents} />
            </p>

            <p className="text-caption text-ink-faint">
              {personalView
                ? t("myRentalSince", {
                    date: formatIsoDate(rental.startOn, locale) ?? rental.startOn,
                  })
                : t("rentalSince", {
                    date: formatIsoDate(rental.startOn, locale) ?? rental.startOn,
                  })}
              {rental.endOn
                ? ` · ${t("rentalUntil", {
                    date: formatIsoDate(rental.endOn, locale) ?? rental.endOn,
                  })}`
                : ""}
            </p>

            {rental.note && <p className="text-caption text-ink-soft">{rental.note}</p>}
          </div>
        ) : personalView ? (
          // Kein Vertrag für das eigene Fach: das ist eine gute Nachricht und
          // kein Fehlzustand — deshalb ein ruhiger Satz, kein leerer Kasten.
          <p className="text-caption text-ink-faint">{t("myRentalNone")}</p>
        ) : locker.hasActiveRental ? (
          // Der Server sagt „vermietet", die RLS gibt uns den Vertrag nicht.
          // Diesen Fall zu verschweigen hieße, ein vermietetes Fach als frei
          // anzubieten.
          <p className="rounded-md bg-sunken px-3 py-2 text-caption text-ink-soft">
            {t("rentalActiveHidden")}
          </p>
        ) : (
          <p className="text-caption text-ink-faint">{t("rentalNone")}</p>
        )}

        {locker.note && <p className="line-clamp-2 text-caption text-ink-soft">{locker.note}</p>}

        {(canAssign || canManage || canRent) && (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {canAssign && locker.status === "free" && (
              <Button size="sm" variant="secondary" icon="lock" onClick={onAssign} disabled={busy}>
                {t("assignCta")}
              </Button>
            )}
            {canAssign && locker.status === "assigned" && (
              <>
                <Button size="sm" variant="secondary" onClick={release} disabled={busy}>
                  {t("releaseCta")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onReassign} disabled={busy}>
                  {t("reassignCta")}
                </Button>
              </>
            )}

            {/* Geld-Achse. „Vermieten" nur, wenn KEIN Vertrag läuft — der
                Server antwortete sonst mit 409, und ein Knopf, der zuverlässig
                scheitert, ist kein Angebot. */}
            {canRent && !locker.hasActiveRental && locker.status !== "broken" && (
              <Button size="sm" variant="secondary" icon="finance" onClick={onRent} disabled={busy}>
                {t("rentCta")}
              </Button>
            )}
            {canRent && rental && rental.status === "aktiv" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditRental(rental)}
                  disabled={busy}
                >
                  {t("editRentalCta")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEndRental(rental)}
                  disabled={busy}
                >
                  {t("endRentalCta")}
                </Button>
              </>
            )}

            {canManage && locker.status !== "broken" && (
              <Button size="sm" variant="ghost" onClick={markBroken} disabled={busy}>
                {t("markBrokenCta")}
              </Button>
            )}
            {canManage && locker.status === "broken" && (
              <Button size="sm" variant="secondary" icon="check" onClick={markRepaired} disabled={busy}>
                {t("markRepairedCta")}
              </Button>
            )}
            {canManage && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" icon="edit" onClick={onEdit} disabled={busy}>
                  {t("editAction")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
                  {t("deleteAction")}
                </Button>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

/**
 * Ein Preis-Wert in seiner jeweils richtigen Typografie: Zahlen in Mono/tabular
 * mit der Einheit als unauffälligem Zusatz, die beiden Wort-Zustände („Kein
 * Preis festgelegt" / „Kostenlos") als normaler Text.
 *
 * Bewusst EINE Komponente statt zweier Inline-Blöcke: Listenpreis und
 * vereinbarter Preis müssen identisch aussehen, sonst liest man in den
 * Unterschied eine Bedeutung hinein, die es nicht gibt.
 */
export function PriceValue({ cents }: { cents: number | null }) {
  const t = useT(schliessfaecherDict);
  const { locale } = useLocale();
  const label = priceLabel(cents, locale, t);

  if (!isPriceNumeric(cents)) {
    return <span className="text-ink-soft">{label}</span>;
  }
  return (
    <span className="font-mono text-mono-table tabular-nums text-ink">
      {label}
      <span className="ml-1 font-body text-caption font-normal text-ink-faint">
        {t("pricePerMonth")}
      </span>
    </span>
  );
}
