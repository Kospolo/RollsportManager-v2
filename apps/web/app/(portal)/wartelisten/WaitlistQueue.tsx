"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden, memberById } from "@/lib/data";
import type { Member, WaitlistEntry, WaitlistKind, WaitlistStatus } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { KIND_KEY, KIND_ORDER, STATUS_KEY, wartelistenDict } from "./i18n";
import {
  KIND_ICON,
  STATUS_TONE,
  countByKind,
  resolveTargetLabel,
  sortEntries,
  type TargetSources,
} from "./derive";
import type { LeaveTarget } from "./LeaveWaitlistDialog";

/**
 * Vereins-Warteschlange (Trainer+): alle Einträge des Vereins mit Mitglied,
 * Ziel und Status — Angebote machen (waiting → offered), erfüllen (→ fulfilled)
 * oder zurücknehmen. Das Entfernen läuft über den Bestätigungs-Dialog des
 * Elternscreens (onRemove). Sichtbarkeit ist Komfort; die Durchsetzung bleibt
 * serverseitig (403 → Toast, kein Zustandswechsel).
 */
export function WaitlistQueue({
  entries,
  members,
  sources,
  onChanged,
  onRemove,
}: {
  entries: WaitlistEntry[];
  members: Member[];
  sources: TargetSources;
  onChanged: () => void;
  onRemove: (target: LeaveTarget) => void;
}) {
  const t = useT(wartelistenDict);
  const [filter, setFilter] = useState<WaitlistKind | "all">("all");

  const counts = useMemo(() => countByKind(entries), [entries]);
  const visible = useMemo(
    () => sortEntries(filter === "all" ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter],
  );

  const filterOptions: FilterChipOption<WaitlistKind | "all">[] = [
    { value: "all", label: t("filterAll"), count: entries.length },
    ...KIND_ORDER.map((kind) => ({ value: kind, label: t(KIND_KEY[kind]), count: counts[kind] })),
  ];

  return (
    <section className="grid gap-4">
      <FilterChips
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        label={t("filterLabel")}
      />
      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("filterEmptyTitle")}
          body={t("filterEmptyBody")}
          action={
            filter !== "all" ? (
              <Button variant="secondary" onClick={() => setFilter("all")}>
                {t("filterEmptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid list-none gap-3">
          {visible.map((entry) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              member={memberById(members, entry.memberId)}
              sources={sources}
              onChanged={onChanged}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Nächster Status je Aktions-Button (Anzeige-Logik; Server bleibt maßgeblich). */
const NEXT: Record<WaitlistStatus, { offer?: true; fulfil?: true; reopen?: true; withdraw?: true }> =
  {
    waiting: { offer: true },
    offered: { fulfil: true, withdraw: true },
    fulfilled: { reopen: true },
    cancelled: { reopen: true },
  };

function QueueRow({
  entry,
  member,
  sources,
  onChanged,
  onRemove,
}: {
  entry: WaitlistEntry;
  member: Member | undefined;
  sources: TargetSources;
  onChanged: () => void;
  onRemove: (target: LeaveTarget) => void;
}) {
  const t = useT(wartelistenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const name = member ? fullName(member) : t("targetUnknown");
  const label = resolveTargetLabel(entry, sources, locale);
  const targetText = label === null ? t("targetGeneral") : (label ?? t("targetUnknown"));
  const actions = NEXT[entry.status];

  const setStatus = async (status: WaitlistStatus) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.updateWaitlist(entry.id, { status });
      showToast(t("statusToast"), { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenManage") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <Avatar
            personId={entry.memberId}
            firstName={member?.firstName ?? "?"}
            lastName={member?.lastName ?? ""}
            avatarUrl={member?.avatarUrl}
            size="m"
          />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate font-display text-[15px] font-bold leading-tight text-ink">
              {name}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral" icon={KIND_ICON[entry.kind]}>
                {t(KIND_KEY[entry.kind])}
              </Badge>
              <span className="truncate text-caption text-ink-soft">{targetText}</span>
            </div>
          </div>
          <Badge tone={STATUS_TONE[entry.status]} className="ml-auto flex-none">
            {t(STATUS_KEY[entry.status])}
          </Badge>
        </div>
        {entry.note && (
          <p className="rounded-lg bg-sunken px-3 py-2 text-caption text-ink-soft">
            „{entry.note}"
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions.offer && (
          <Button size="sm" icon="check" disabled={submitting} onClick={() => setStatus("offered")}>
            {t("actOffer")}
          </Button>
        )}
        {actions.fulfil && (
          <Button
            size="sm"
            icon="check"
            disabled={submitting}
            onClick={() => setStatus("fulfilled")}
          >
            {t("actFulfil")}
          </Button>
        )}
        {actions.withdraw && (
          <Button
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => setStatus("waiting")}
          >
            {t("actWithdraw")}
          </Button>
        )}
        {actions.reopen && (
          <Button
            size="sm"
            variant="ghost"
            disabled={submitting}
            onClick={() => setStatus("waiting")}
          >
            {t("actReopen")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          disabled={submitting}
          onClick={() => onRemove({ entry, mode: "trainer", memberName: name })}
        >
          {t("actRemove")}
        </Button>
      </div>
    </li>
  );
}
