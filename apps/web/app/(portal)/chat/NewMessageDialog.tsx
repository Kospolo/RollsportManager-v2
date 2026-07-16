"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, fullName } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { chatDict } from "./i18n";

/**
 * „Neue Nachricht an …" — die Empfängerauswahl, die bis jetzt gefehlt hat.
 * /chat/channels liefert nur BESTEHENDE Fäden; ohne diesen Dialog gab es keinen
 * Weg, jemanden zum ersten Mal anzuschreiben.
 *
 * WOHER DIE LISTE KOMMT: ausschließlich repo.listChatRecipients() →
 * GET /chat/recipients. Der Server filtert mit app.chat_dm_allowed (Migration
 * 0043) — demselben Prädikat, das die RLS beim Senden prüft — und redigiert die
 * Zeilen auf demselben Weg wie die Mitgliederliste (ohne can_manage_members nur
 * Namen, KEINE Geburtsdaten/E-Mail). Hier wird BEWUSST nicht die volle
 * Mitgliederliste geholt und clientseitig gefiltert: das wäre ein zweiter,
 * weiterer Weg in den Bestand und würde die Kinderschutz-Regel zur Kosmetik
 * machen. Die Suche unten filtert nur das, was der Server schon erlaubt hat.
 */
export function NewMessageDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (member: Member) => void;
}) {
  const t = useT(chatDict);
  const [query, setQuery] = useState("");

  const recipients = useData((repo) => repo.listChatRecipients());

  const hits = useMemo(() => {
    const list = recipients.data ?? [];
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return list;
    return list.filter((m) => fullName(m).toLocaleLowerCase().includes(needle));
  }, [recipients.data, query]);

  const pick = (member: Member) => {
    onPick(member);
    setQuery("");
    onClose();
  };

  let body;
  if (recipients.status === "loading") {
    body = (
      <div className="grid gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (recipients.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("channelsErrorTitle")}
        body={errorMessage(recipients.error) || t("recipientsLoadError")}
        action={<Button onClick={recipients.reload}>{t("retry")}</Button>}
      />
    );
  } else if (recipients.data.length === 0) {
    body = (
      <EmptyState icon="mail" title={t("recipientsEmptyTitle")} body={t("recipientsEmptyBody")} />
    );
  } else if (hits.length === 0) {
    body = (
      <EmptyState
        icon="mail"
        title={t("recipientsNoHitTitle")}
        body={t("recipientsNoHitBody", { query: query.trim() })}
      />
    );
  } else {
    body = (
      <ul className="grid gap-1">
        {hits.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => pick(m)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-sunken"
            >
              <Avatar
                personId={m.id}
                firstName={m.firstName}
                lastName={m.lastName}
                avatarUrl={m.avatarUrl}
                size="m"
              />
              <b className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
                {fullName(m)}
              </b>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("newMessageEyebrow")}
      title={t("newMessageTitle")}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Input
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[45dvh] min-h-[8rem] overflow-y-auto">{body}</div>
        {/* Sagt, WARUM hier weniger Leute stehen als in der Mitgliederliste.
            Ohne diesen Satz wirkt die Kinderschutz-Regel wie ein Fehler. */}
        <p className="text-[12.5px] text-ink-soft">{t("recipientsChildProtectionNote")}</p>
      </div>
    </Modal>
  );
}
