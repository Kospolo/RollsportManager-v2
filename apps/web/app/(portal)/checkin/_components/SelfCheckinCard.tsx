"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Checkin, Event, Id } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { checkinDict } from "../i18n";
import { defaultEventId, hasCheckinToday } from "../logic";
import { EventSelect } from "./EventSelect";

/**
 * „Selbst einchecken": jedes Mitglied trägt sich für seinen heutigen/nächsten
 * Termin ein (data.createCheckin, method 'manual', memberId = eigenes Mitglied).
 * Serverseitig erlaubt für das eigene Mitglied ODER Trainer:innen; ein 403
 * kommt als Klartext-Toast zurück. Vorbelegt ist der erste heutige Termin.
 */
export function SelfCheckinCard({
  memberId,
  events,
  myCheckins,
  now,
  onCheckedIn,
}: {
  memberId: Id;
  events: Event[];
  myCheckins: Checkin[];
  now: Date;
  onCheckedIn: () => void;
}) {
  const t = useT(checkinDict);
  const { showToast } = useToast();

  const [eventId, setEventId] = useState<string>(() => defaultEventId(events, now));
  const [submitting, setSubmitting] = useState(false);

  const checkedInToday = useMemo(() => hasCheckinToday(myCheckins, now), [myCheckins, now]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.createCheckin({
        memberId,
        eventId: eventId || undefined,
        method: "manual",
      });
      showToast(t("selfDoneToast"), { tone: "success" });
      onCheckedIn();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("selfTitle")} sub={t("selfSub")} />

      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <EventSelect value={eventId} onChange={setEventId} events={events} now={now} />

        {checkedInToday && (
          <p className="text-caption font-semibold text-success">{t("selfTodayNote")}</p>
        )}

        <div className="flex justify-end">
          <Button icon="check" onClick={submit} disabled={submitting}>
            {t("selfCta")}
          </Button>
        </div>
      </div>
    </section>
  );
}
