"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { data } from "@/lib/data";
import type { OfferRideInput } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Event } from "@/lib/types";
import { termineDict } from "../i18n";

/**
 * „Fahrt anbieten" — Abfahrtsort, Zeitpunkt, Plätze, Rückrufnummer, Notiz.
 *
 * ### VORBELEGUNG DER RÜCKRUFNUMMER ###
 * Sie kommt aus dem EIGENEN Profil (getMemberProfile der eingeloggten Person),
 * nicht aus einer Mitgliederliste: die eigene Telefonnummer darf man sehen,
 * fremde nicht. Ist keine hinterlegt, bleibt das Feld leer — und wird BEIM
 * ABSCHICKEN weggelassen statt als null gesendet, damit der Server seine
 * eigene Vorbelegung noch anwenden kann (ein leeres Feld heißt „nimm meine
 * Nummer", nicht „lösch sie").
 *
 * ### DATUM UND UHRZEIT, NICHT NUR UHRZEIT ###
 * Auswärtsfahrten gehen über Nacht los — „06:30" allein wäre mehrdeutig, wenn
 * der Wettkampf zwei Tage dauert. Vorbelegt ist der Termintag, eine Stunde vor
 * Beginn; beides bleibt änderbar.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function defaultDeparture(event: Event): { date: string; time: string } {
  const start = new Date(event.startsAt);
  const suggestion = new Date(start.getTime() - 60 * 60 * 1000);
  return {
    date: `${suggestion.getFullYear()}-${pad(suggestion.getMonth() + 1)}-${pad(suggestion.getDate())}`,
    time: `${pad(suggestion.getHours())}:${pad(suggestion.getMinutes())}`,
  };
}

export function OfferRideSheet({
  event,
  ownMemberId,
  onClose,
  onSubmit,
}: {
  event: Event;
  ownMemberId: string;
  onClose: () => void;
  /** Schreibt über die Facade (im Panel), damit dort auch der Toast entsteht. */
  onSubmit: (input: OfferRideInput) => Promise<boolean>;
}) {
  const t = useT(termineDict);

  const initial = defaultDeparture(event);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [seats, setSeats] = useState("3");
  const [phone, setPhone] = useState("");
  /** true = das Feld trägt die Profilnummer (Hinweistext statt Datenschutz-Text). */
  const [phonePrefilled, setPhonePrefilled] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Eigene Telefonnummer nachladen. Schlägt es fehl, bleibt das Feld leer —
  // das ist kein Fehlerfall, sondern der Normalfall „keine Nummer hinterlegt".
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const profile = await data.getMemberProfile(ownMemberId);
        const own = profile.member.phone;
        if (alive && own) {
          setPhone(own);
          setPhonePrefilled(true);
        }
      } catch {
        /* keine Vorbelegung — die Person tippt die Nummer selbst */
      }
    })();
    return () => {
      alive = false;
    };
  }, [ownMemberId]);

  function validate(): OfferRideInput | null {
    const next: Record<string, string> = {};
    if (place.trim() === "") next.place = t("errRideFrom");
    if (!date || !time) next.when = t("errRideWhen");
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 8) {
      next.seats = t("errRideSeats");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    const departure = new Date(`${date}T${time}`);
    return {
      departurePlace: place.trim(),
      departureAt: departure.toISOString(),
      seatsTotal: seatCount,
      note: note.trim() === "" ? null : note.trim(),
      // Leer + unverändert = „nimm meine hinterlegte Nummer" (Feld weglassen).
      // Leer, obwohl vorbelegt war = bewusst gelöscht → null.
      ...(phone.trim() === ""
        ? phonePrefilled
          ? { callbackNumber: null }
          : {}
        : { callbackNumber: phone.trim() }),
    };
  }

  async function submit() {
    if (submitting) return;
    const input = validate();
    if (!input) return;
    setSubmitting(true);
    const ok = await onSubmit(input);
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("rideOfferEyebrow")}
      title={t("rideOfferTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {t("rideOfferSubmit")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-[13.5px] text-ink-soft">{event.title}</p>

        <Input
          label={t("fRideFrom")}
          placeholder={t("fRideFromPh")}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          error={errors.place}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fRideDate")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.when}
          />
          <Input
            label={t("fRideTime")}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <Input
          label={t("fRideSeats")}
          type="number"
          min={1}
          max={8}
          inputMode="numeric"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          hint={t("fRideSeatsHint")}
          error={errors.seats}
        />

        {/* Der Datenschutz-Satz steht IMMER da — auch bei Vorbelegung: wer eine
            Nummer einträgt, soll wissen, wer sie danach sehen kann. */}
        <Input
          label={t("fRidePhone")}
          placeholder={t("fRidePhonePh")}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          hint={
            phonePrefilled
              ? `${t("fRidePhonePrefilled")} ${t("fRidePhoneHint")}`
              : t("fRidePhoneHint")
          }
        />

        <Textarea
          label={t("fRideNote")}
          placeholder={t("fRideNotePh")}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
