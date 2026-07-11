"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Department, Member } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { abteilungenDict } from "../i18n";

/**
 * Mitglieder einer Abteilung (Sheet). Für alle Mitglieder eine Lesesicht; für
 * Trainer:innen/Admins zusätzlich der Zuordnungs-Editor: Mehrfachauswahl aus den
 * Vereinsmitgliedern → beim Speichern geht der VOLLE Satz an die Facade
 * (setDepartmentMembers, Full-Replace). Erfolg: Toast + onSaved() + schließen;
 * 403 als Klartext-Toast, Sheet bleibt offen. Der Dialog wird pro Abteilung
 * frisch gemountet, daher genügen die useState-Startwerte.
 */

function MemberRow({
  member,
  selected,
  onToggle,
}: {
  member: Member;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <Avatar
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          size="m"
        />
        <div className="grid min-w-0 flex-1">
          <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
          <span className="truncate text-[12px] text-ink-faint">
            {member.email ??
              (member.birthDate ? String(new Date(member.birthDate).getFullYear()) : "—")}
          </span>
        </div>
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 flex-none place-items-center rounded-md border transition-colors duration-150 ${
            selected ? "border-brand bg-brand text-brand-contrast" : "border-line text-transparent"
          }`}
        >
          <Icon name="check" className="ic h-4 w-4" />
        </span>
      </button>
    </li>
  );
}

function ReadOnlyRoster({ roster }: { roster: Member[] }) {
  const t = useT(abteilungenDict);
  if (roster.length === 0) {
    return (
      <p className="rounded-md bg-sunken px-4 py-3 text-[13px] text-ink-soft">{t("membersEmpty")}</p>
    );
  }
  return (
    <ul className="grid divide-y divide-line">
      {roster.map((member) => (
        <li key={member.id} className="flex items-center gap-3 py-2">
          <Avatar
            personId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            size="m"
          />
          <div className="grid min-w-0 flex-1">
            <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
            <span className="truncate text-[12px] text-ink-faint">
              {member.email ??
                (member.birthDate ? String(new Date(member.birthDate).getFullYear()) : "—")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DepartmentMembersSheet({
  department,
  members,
  canAssign,
  onClose,
  onSaved,
}: {
  department: Department;
  members: Member[];
  canAssign: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(abteilungenDict);
  const { showToast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(() => new Set(department.memberIds));
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  const roster = useMemo(() => {
    const ids = new Set(department.memberIds);
    return sorted.filter((m) => ids.has(m.id));
  }, [sorted, department.memberIds]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((m) => fullName(m).toLowerCase().includes(needle));
  }, [sorted, query]);

  const toggle = (memberId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.setDepartmentMembers(department.id, { memberIds: [...selected] });
      showToast(t("rosterSavedToast", { name: department.name }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const count = selected.size;
  const summary =
    count === 1 ? t("selectedSummaryOne", { n: count }) : t("selectedSummaryMany", { n: count });

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("membersEyebrow")}
      title={t("membersTitle", { name: department.name })}
      footer={
        canAssign ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button icon="check" onClick={save} disabled={submitting}>
              {t("saveRoster")}
            </Button>
          </>
        ) : undefined
      }
    >
      {!canAssign ? (
        <div className="grid gap-4">
          <p className="text-[13px] text-ink-soft">{t("membersReadHint")}</p>
          <ReadOnlyRoster roster={roster} />
        </div>
      ) : members.length === 0 ? (
        <p className="rounded-md bg-sunken px-4 py-3 text-[13px] text-ink-soft">
          {t("noClubMembers")}
        </p>
      ) : (
        <div className="grid gap-4">
          <p className="text-[13px] text-ink-soft">{t("assignHint")}</p>

          <label className="relative flex min-h-11 items-center">
            <span className="sr-only">{t("searchLabel")}</span>
            <Icon
              name="search"
              className="ic pointer-events-none absolute left-4 h-4 w-4 text-ink-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-h-11 w-full rounded-full border border-transparent bg-sunken pl-10 pr-4 text-body text-ink placeholder:text-ink-faint"
            />
          </label>

          <p className="text-caption font-semibold text-ink-faint" aria-live="polite">
            {summary}
          </p>

          {rows.length === 0 ? (
            <p className="px-1 py-3 text-[13px] text-ink-faint">{t("searchEmpty")}</p>
          ) : (
            <ul className="grid divide-y divide-line">
              {rows.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  selected={selected.has(member.id)}
                  onToggle={() => toggle(member.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
