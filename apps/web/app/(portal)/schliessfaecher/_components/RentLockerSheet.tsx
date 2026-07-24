"use client";

import { useMemo, useState } from "react";
import { ApiError, data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateLockerRentalInput, UpdateLockerRentalInput } from "@/lib/data";
import type { Locker, LockerRental, Member } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { schliessfaecherDict } from "../i18n";
import { parsePriceInput, priceLabel, priceToInput, todayIso } from "../derive";

const FORM_ID = "rent-locker-form";

/**
 * VERMIETEN (neuer Vertrag) oder eine bestehende Vermietung BEARBEITEN — 0070,
 * owner/admin/treasurer. Nicht zu verwechseln mit „Zuordnen": dort geht es um
 * den Schlüssel, hier um Geld.
 *
 * ### DIE ZWEITE PREISEBENE ###
 * Der Vorschlag kommt aus dem LISTENPREIS des Fachs, die Entscheidung trifft
 * ein Mensch — das Feld ist von Anfang an überschreibbar und der Hinweis sagt,
 * woher der Wert stammt. Was gespeichert wird, ist der VEREINBARTE Preis; der
 * Listenpreis bleibt unberührt. Deshalb wird hier nirgends beim Speichern auf
 * den Listenpreis zurückgefallen: ändert der Verein ihn nächstes Jahr, darf das
 * laufende Verträge nicht rückwirkend verteuern.
 *
 * Beim BEARBEITEN wird die Vorbelegung bewusst aus dem VERTRAG genommen, nicht
 * aus dem Fach — sonst überschriebe ein Öffnen-und-Speichern still die
 * Vereinbarung mit dem aktuellen Listenpreis.
 *
 * Mitglied/Fach sind serverseitig unveränderlich; im Bearbeiten-Modus steht das
 * Mitglied deshalb als Text da und nicht als Auswahl.
 */
export type RentSheetValue =
  | { mode: "create"; locker: Locker }
  | { mode: "edit"; locker: Locker; rental: LockerRental };

export function RentLockerSheet({
  value,
  members,
  onClose,
  onSaved,
}: {
  value: RentSheetValue;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const isEdit = value.mode === "edit";
  const locker = value.locker;
  const rental = isEdit ? value.rental : undefined;

  const selectable = useMemo(
    () =>
      members
        .filter((m) => m.status === "active")
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(
    rental?.memberId ?? locker.assignedMemberId ?? "",
  );
  // Vorbelegung: Vertrag schlägt Fach. Siehe Kopf.
  const [price, setPrice] = useState(
    priceToInput(rental ? rental.pricePerMonthCents : locker.pricePerMonthCents, locale),
  );
  const [startOn, setStartOn] = useState(rental?.startOn ?? todayIso());
  const [endOn, setEndOn] = useState(rental?.endOn ?? "");
  const [note, setNote] = useState(rental?.note ?? "");

  const [priceError, setPriceError] = useState<string | undefined>(undefined);
  const [startError, setStartError] = useState<string | undefined>(undefined);
  const [endError, setEndError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectable;
    return selectable.filter((m) => fullName(m).toLowerCase().includes(needle));
  }, [selectable, query]);

  const selectedMember = members.find((m) => m.id === selectedId);

  const validate = (): { cents: number | null } | null => {
    const parsed = parsePriceInput(price);
    let ok = true;
    if (!parsed.ok) {
      setPriceError(t("fPriceError"));
      ok = false;
    }
    if (!startOn) {
      setStartError(t("rentStartError"));
      ok = false;
    }
    // Reine Textvergleiche reichen: ISO-Daten (YYYY-MM-DD) sortieren
    // lexikografisch korrekt, und es entsteht keine Zeitzonen-Verschiebung.
    if (endOn && startOn && endOn < startOn) {
      setEndError(t("rentEndBeforeStart"));
      ok = false;
    }
    if (!ok || !parsed.ok) return null;
    return { cents: parsed.cents };
  };

  const submit = async () => {
    if (submitting) return;
    if (!selectedId) {
      showToast(t("pickMemberFirst"), { tone: "danger" });
      return;
    }
    const valid = validate();
    if (!valid) return;

    const trimmedNote = note.trim();
    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateLockerRentalInput = {
          lockerId: locker.id,
          memberId: selectedId,
          pricePerMonthCents: valid.cents,
          startOn,
          endOn: endOn || null,
          note: trimmedNote || null,
        };
        await data.createLockerRental(input);
        showToast(
          t("rentedToast", {
            label: locker.label,
            name: selectedMember ? fullName(selectedMember) : t("unknownMember"),
          }),
          { tone: "success" },
        );
      } else {
        const patch: UpdateLockerRentalInput = {
          pricePerMonthCents: valid.cents,
          startOn,
          endOn: endOn || null,
          note: trimmedNote || null,
        };
        await data.updateLockerRental(value.rental.id, patch);
        showToast(t("rentalUpdatedToast", { label: locker.label }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      // 409 „schon vermietet" bekommt eine eigene Aussage — „Fehler beim
      // Speichern" würde die Kassenwartin nicht wissen lassen, was zu tun ist.
      const conflict = caught instanceof ApiError && caught.status === 409;
      showToast(
        conflict
          ? t("rentalBusy")
          : isForbidden(caught)
            ? t("forbiddenRental")
            : errorMessage(caught),
        { tone: "danger" },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={isEdit ? t("editRentalEyebrow") : t("rentEyebrow")}
      title={t(isEdit ? "editRentalTitle" : "rentTitle", { label: locker.label })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon="check"
            disabled={submitting || !selectedId}
          >
            {isEdit ? t("rentSaveSubmit") : t("rentSubmit")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft">
          {t("rentIntro")}
        </p>

        {isEdit ? (
          // Mitglied und Fach sind serverseitig unveränderlich — hier steht
          // deshalb Text und keine Auswahl. Ein anderes Mitglied heißt: alten
          // Vertrag beenden, neuen anlegen.
          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("rentMemberLabel")}</span>
            <span className="flex items-center gap-2.5 rounded-md bg-sunken px-3 py-2">
              {selectedMember ? (
                <>
                  <Avatar
                    personId={selectedMember.id}
                    firstName={selectedMember.firstName}
                    lastName={selectedMember.lastName}
                    size="s"
                  />
                  <span className="truncate text-[14px] font-semibold text-ink">
                    {fullName(selectedMember)}
                  </span>
                </>
              ) : (
                <span className="text-caption text-ink-soft">{t("unknownMember")}</span>
              )}
            </span>
          </div>
        ) : (
          <>
            <Input
              label={t("searchLabel")}
              type="search"
              autoComplete="off"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            {selectable.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-caption text-ink-soft">
                {t("noActiveMembers")}
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-caption text-ink-soft">
                {t("searchNoMatch")}
              </p>
            ) : (
              <ul className="grid max-h-[34vh] list-none gap-1 overflow-y-auto">
                {filtered.map((member) => {
                  const active = member.id === selectedId;
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedId(member.id)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors duration-150 ${
                          active
                            ? "border-transparent bg-brand-soft text-brand-ink"
                            : "border-transparent bg-sunken text-ink hover:bg-line/60"
                        }`}
                      >
                        <Avatar
                          personId={member.id}
                          firstName={member.firstName}
                          lastName={member.lastName}
                          size="s"
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                          {fullName(member)}
                        </span>
                        {active && <Icon name="check" className="ic h-4 w-4 flex-none" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <Input
          label={t("rentPriceLabel")}
          placeholder={t("fPricePlaceholder")}
          inputMode="decimal"
          autoComplete="off"
          hint={
            isEdit
              ? t("rentPriceHint")
              : locker.pricePerMonthCents === null
                ? t("rentPriceNoList")
                : t("rentPriceFromList", {
                    price: priceLabel(locker.pricePerMonthCents, locale, t),
                  })
          }
          error={priceError}
          value={price}
          onChange={(event) => {
            setPrice(event.target.value);
            if (priceError) setPriceError(undefined);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("rentStartLabel")}
            type="date"
            error={startError}
            value={startOn}
            onChange={(event) => {
              setStartOn(event.target.value);
              if (startError) setStartError(undefined);
              if (endError) setEndError(undefined);
            }}
          />
          <Input
            label={t("rentEndLabel")}
            type="date"
            hint={t("rentEndHint")}
            error={endError}
            value={endOn}
            onChange={(event) => {
              setEndOn(event.target.value);
              if (endError) setEndError(undefined);
            }}
          />
        </div>

        <Textarea
          label={t("rentNoteLabel")}
          placeholder={t("rentNotePlaceholder")}
          rows={3}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Sheet>
  );
}
