"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Locker, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { schliessfaecherDict } from "../i18n";

const FORM_ID = "assign-locker-form";

/**
 * „Zuordnen"/„Umbuchen"-Sheet: durchsuchbarer Mitglieder-Picker (nur aktive
 * Mitglieder, Avatar + Name, Einfachauswahl) für ein Schließfach. Schreibt über
 * data.assignLocker (status → belegt). Beim Umbuchen wird die aktuelle Belegung
 * als Hinweis gezeigt. Erfolg: Toast + onAssigned() + schließen; 403 bleibt ein
 * ruhiger Klartext-Toast, das Sheet bleibt offen. Rechte serverseitig
 * (is_club_trainer) — die Sichtbarkeit hier ist nur Komfort.
 */
export function AssignLockerSheet({
  locker,
  members,
  onClose,
  onAssigned,
}: {
  locker: Locker;
  members: Member[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { showToast } = useToast();

  const isReassign = locker.status === "assigned";
  const currentName = useMemo(() => {
    const current = members.find((m) => m.id === locker.assignedMemberId);
    return current ? fullName(current) : undefined;
  }, [members, locker.assignedMemberId]);

  const selectable = useMemo(
    () =>
      members
        .filter((m) => m.status === "active")
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(locker.assignedMemberId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selectable;
    return selectable.filter((m) => fullName(m).toLowerCase().includes(needle));
  }, [selectable, query]);

  const submit = async () => {
    if (submitting) return;
    if (!selectedId) {
      showToast(t("pickMemberFirst"), { tone: "danger" });
      return;
    }
    setSubmitting(true);
    try {
      const updated = await data.assignLocker(locker.id, { memberId: selectedId });
      const name = members.find((m) => m.id === selectedId);
      showToast(
        t("assignedToast", {
          label: updated.label,
          name: name ? fullName(name) : t("unknownMember"),
        }),
        { tone: "success" },
      );
      onAssigned();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenAssign") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("assignEyebrow")}
      title={t(isReassign ? "reassignTitle" : "assignTitle", { label: locker.label })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting || !selectedId}>
            {t("assignSubmit")}
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
        {isReassign && currentName && (
          <p className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft">
            {t("currentlyAssigned", { name: currentName })}
          </p>
        )}

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
          <ul className="grid max-h-[52vh] list-none gap-1 overflow-y-auto">
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
      </form>
    </Sheet>
  );
}
