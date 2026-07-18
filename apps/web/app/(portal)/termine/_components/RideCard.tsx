"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/format";
import type { Ride, RideRider } from "@/lib/data";
import { termineDict } from "../i18n";

/**
 * EINE angebotene Fahrt. Rein darstellend — geladen, geschrieben und
 * zurückgerollt wird im RidesPanel.
 *
 * Signatur der Karte sind die SITZ-PUNKTE: gefüllt = belegt, offen = frei. Das
 * ist die eine Information, wegen der Eltern diese Liste überhaupt öffnen
 * („passe ich noch rein?"), und sie ist auf einen Blick lesbar, bevor man die
 * Zeile daneben liest. Für Screenreader steht dieselbe Aussage als Text.
 */

function SeatDots({ total, free }: { total: number; free: number }) {
  const taken = Math.max(total - free, 0);
  return (
    <span className="flex flex-none items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            i < taken ? "bg-ink-faint" : "border border-line-strong bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Die Rückrufnummer. DREI Zustände, die nicht verwechselt werden dürfen:
 * geliefert (anrufbar), gesperrt (kommt nach der Zusage), nicht hinterlegt.
 *
 * Die UI ENTSCHEIDET hier nichts: sie liest `contactVisible` aus der Antwort.
 * Wer die Nummer nicht sehen darf, hat sie nie im Browser gehabt — es gibt
 * nichts zu verbergen, weil nichts angekommen ist.
 */
function CallbackNumber({ ride }: { ride: Ride }) {
  const t = useT(termineDict);

  if (!ride.contactVisible) {
    return (
      <p className="inline-flex items-start gap-2 text-caption text-ink-faint">
        <Icon name="lock" className="ic mt-px h-3.5 w-3.5 flex-none" />
        {t("rideContactLocked")}
      </p>
    );
  }
  if (!ride.callbackNumber) {
    return <p className="text-caption text-ink-faint">{t("rideContactNone")}</p>;
  }
  return (
    <p className="inline-flex items-center gap-2 text-[13.5px] text-ink-soft">
      <Icon name="phone" className="ic h-4 w-4 flex-none text-ink-faint" />
      <span className="sr-only">{t("rideContactLabel")}: </span>
      <a
        href={`tel:${ride.callbackNumber.replace(/\s/g, "")}`}
        className="font-bold text-ink underline decoration-line-strong underline-offset-4"
      >
        {ride.callbackNumber}
      </a>
    </p>
  );
}

export function RideCard({
  ride,
  /** Zusage der eingeloggten Person oder eines ihrer Kinder — sonst undefined. */
  ownRider,
  canJoin,
  canManage,
  busy,
  onJoin,
  onLeave,
  onCancelRide,
}: {
  ride: Ride;
  ownRider?: RideRider;
  /** Anzeige-Gate: es sind Personen übrig, für die zugesagt werden kann. */
  canJoin: boolean;
  /** Fahrer:in dieser Fahrt oder Vereinsverwaltung. */
  canManage: boolean;
  busy: boolean;
  onJoin: () => void;
  onLeave: (rider: RideRider) => void;
  onCancelRide: () => void;
}) {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const cancelled = ride.status === "cancelled";
  const full = ride.status === "full";
  const driverName = `${ride.driverFirstName} ${ride.driverLastName}`;

  return (
    <article
      className={`grid gap-3 rounded-lg border border-line bg-canvas p-4 ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <header className="flex flex-wrap items-start gap-2">
        <h4 className="min-w-0 flex-1 text-[14px] font-bold text-ink">
          {t("rideDriverLabel", { name: driverName })}
        </h4>
        {cancelled ? (
          <Badge tone="danger">{t("rideCancelledBadge")}</Badge>
        ) : (
          full && <Badge tone="warn">{t("rideSeatsNone")}</Badge>
        )}
      </header>

      <div className="grid gap-1.5 text-[13.5px] text-ink-soft">
        <span className="inline-flex items-start gap-2">
          <Icon name="pin" className="ic mt-px h-4 w-4 flex-none text-ink-faint" />
          {ride.departurePlace}
        </span>
        <span className="inline-flex items-start gap-2">
          <Icon name="clock" className="ic mt-px h-4 w-4 flex-none text-ink-faint" />
          {t("rideDeparture", {
            date: formatDate(ride.departureAt, locale),
            time: formatTime(ride.departureAt, locale),
          })}
        </span>
        <span className="inline-flex items-center gap-2">
          <SeatDots total={ride.seatsTotal} free={ride.seatsFree} />
          <span>
            {ride.seatsFree === 0
              ? t("rideSeatsNone")
              : t("rideSeatsFree", { n: ride.seatsFree, total: ride.seatsTotal })}
          </span>
        </span>
        <CallbackNumber ride={ride} />
      </div>

      {ride.note && (
        <div className="grid gap-1 rounded-md bg-sunken px-3.5 py-2.5">
          <span className="eyebrow">{t("rideNoteTitle")}</span>
          <p className="text-[13px] leading-[19px] text-ink-soft">{ride.note}</p>
        </div>
      )}

      <div className="grid gap-1.5">
        <span className="eyebrow">{t("rideRidersTitle")}</span>
        {ride.riders.length === 0 ? (
          <p className="text-caption text-ink-faint">{t("rideNoRiders")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {ride.riders.map((rider) => (
              <li key={rider.id}>
                <Badge tone={rider.id === ownRider?.id ? "success" : "neutral"}>
                  {rider.memberFirstName} {rider.memberLastName}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!cancelled && (
        <footer className="flex flex-wrap gap-2">
          {ownRider ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onLeave(ownRider)}>
              {t("rideLeave")}
            </Button>
          ) : (
            canJoin &&
            // Ausgebucht heißt AUSGEBUCHT — kein Knopf, der ins Leere führt.
            (full ? (
              <span className="inline-flex min-h-9 items-center text-caption font-semibold text-ink-faint">
                {t("rideSeatsNone")}
              </span>
            ) : (
              <Button size="sm" disabled={busy} onClick={onJoin}>
                {t("rideJoin")}
              </Button>
            ))
          )}
          {canManage && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelRide}>
              {t("rideCancelRide")}
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
