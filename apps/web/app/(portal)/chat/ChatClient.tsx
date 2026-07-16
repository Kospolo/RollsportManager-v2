"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, fullName } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { ChatChannel, Id, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { chatDict } from "./i18n";
import { channelKey } from "./helpers";
import { ChannelList } from "./ChannelList";
import { MessageThread } from "./MessageThread";
import { NewMessageDialog } from "./NewMessageDialog";

/**
 * Chat-Screen (Nachrichten): Zwei-Spalten-Layout. Links die Kanalliste (meine
 * Team-Kanäle + Direkt-Konversationen), rechts der Nachrichten-Thread mit
 * Eingabefeld. Mobil wird immer nur EINE Spalte gezeigt (Liste → Thread mit
 * Zurück-Knopf). Alle Datenpfade laufen über die Facade (lib/data); die Rechte
 * sind serverseitig (RLS, Referenz 1.3) — die UI zeigt nur an.
 *
 * ZWEI DINGE, DIE HIER GEFEHLT HABEN:
 * (1) Wer in KEINEM Team ist (typisch: der Vorstand) und noch keine
 *     Direktnachricht hat, sah einen komplett leeren Bildschirm und hielt den
 *     Chat für kaputt. Fachlich ist die Liste richtig leer — aber sie muss das
 *     ERKLÄREN und den Weg zeigen, statt nur leer zu sein.
 * (2) Es gab keinen Weg, jemanden NEU anzuschreiben (nur bestehende Fäden).
 *     Dafür der „Neue Nachricht"-Knopf + NewMessageDialog. Die ausgewählte
 *     Person wird als ENTWURF-Kanal geöffnet (noch kein Fadeb in der DB); erst
 *     die erste gesendete Nachricht legt den Faden an — danach taucht er bei
 *     beiden Seiten regulär in /chat/channels auf.
 * Der Vorstand bekommt hier bewusst NICHT alle Team-Kanäle zu sehen: in denen
 * schreiben Kinder, und Mitlesen ohne Anlass ist keine Vorstandsaufgabe. Wer
 * einen Team-Kanal lesen soll, gehört sichtbar ins Team.
 */
export function ChatClient() {
  const t = useT(chatDict);

  const channels = useData((repo) => repo.listChatChannels());
  const members = useData((repo) => repo.getMembers());
  const me = useData((repo) => repo.getCurrentUser());

  const nameOf = useMemo(() => {
    const map = new Map<Id, string>();
    for (const m of members.data ?? []) map.set(m.id, fullName(m));
    return (id: Id) => map.get(id) ?? id;
  }, [members.data]);

  const currentMemberId: Id = me.data?.id ?? "";

  const [selected, setSelected] = useState<ChatChannel | null>(null);
  const [composing, setComposing] = useState(false);
  const selectedKey = selected ? channelKey(selected) : null;

  /**
   * Empfänger gewählt → Entwurfs-Kanal öffnen. Existiert der Faden schon, wird
   * der BESTEHENDE Kanal genommen (samt Vorschau), sonst ein leerer Direkt-
   * Kanal ohne lastMessage — MessageThread zeigt dafür bereits „Schreib die
   * erste Nachricht an {name}." und lädt die (leere) Historie.
   */
  const startThread = (member: Member) => {
    const existing = (channels.data ?? []).find(
      (ch) => ch.channelType === "direct" && ch.peerMemberId === member.id,
    );
    setSelected(
      existing ?? {
        channelType: "direct",
        peerMemberId: member.id,
        peerName: fullName(member),
      },
    );
  };

  let listBody: ReactNode;
  if (channels.status === "loading") {
    listBody = (
      <div className="grid gap-2 p-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  } else if (channels.status === "error") {
    listBody = (
      <div className="grid h-full place-items-center p-4">
        <EmptyState
          icon="zap"
          title={t("channelsErrorTitle")}
          body={errorMessage(channels.error) || t("channelsErrorBody")}
          action={<Button onClick={channels.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  } else if (channels.data.length === 0) {
    // Leer ist hier fachlich RICHTIG (keine Team-Mitgliedschaft, keine DM) —
    // aber ein leerer Bildschirm ohne Erklärung ist trotzdem ein Fehler. Wer in
    // keinem Team ist, bekommt den Grund genannt UND den Weg raus.
    const noTeam = (members.data ?? []).find((m) => m.id === currentMemberId)?.teamIds.length === 0;
    listBody = (
      <div className="grid h-full place-items-center p-4">
        <EmptyState
          icon="mail"
          title={noTeam ? t("listEmptyNoTeamTitle") : t("listEmptyTitle")}
          body={noTeam ? t("listEmptyNoTeamBody") : t("listEmptyBody")}
          action={<Button onClick={() => setComposing(true)}>{t("newMessage")}</Button>}
        />
      </div>
    );
  } else {
    listBody = (
      <ChannelList
        channels={channels.data}
        selectedKey={selectedKey}
        onSelect={setSelected}
        nameOf={nameOf}
        currentMemberId={currentMemberId}
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={
          <Button variant="ghost" size="sm" onClick={channels.reload}>
            {t("refresh")}
          </Button>
        }
      />

      <div className="flex h-[calc(100dvh-13rem)] min-h-[26rem] overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:h-[calc(100dvh-10.5rem)]">
        <aside
          className={`min-h-0 flex-col border-line lg:flex lg:w-[320px] lg:flex-none lg:border-r ${
            selected ? "hidden lg:flex" : "flex w-full"
          }`}
        >
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <b className="font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
              {t("channelsHeading")}
            </b>
            <Button size="sm" onClick={() => setComposing(true)}>
              {t("newMessage")}
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{listBody}</div>
        </aside>

        <section
          className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden lg:flex"}`}
        >
          {selected ? (
            <MessageThread
              key={selectedKey ?? ""}
              channel={selected}
              currentMemberId={currentMemberId}
              nameOf={nameOf}
              onBack={() => setSelected(null)}
              onActivity={channels.reload}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState icon="mail" title={t("pickChannelTitle")} body={t("pickChannelBody")} />
            </div>
          )}
        </section>
      </div>

      <NewMessageDialog
        open={composing}
        onClose={() => setComposing(false)}
        onPick={startThread}
      />
    </div>
  );
}
