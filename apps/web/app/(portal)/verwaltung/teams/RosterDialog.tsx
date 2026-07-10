"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Member, Team } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { teamsDict } from "./i18n";
import { initialRoles, sortByName, type TeamRole } from "./derive";

/**
 * Kader-Editor (Sheet): jede Person bekommt eine Team-Rolle
 * (Kein / Trainer / Sportler). Beim Speichern geht der VOLLE Satz an die
 * Facade (setTeamMembers) — nicht gewählte Personen werden serverseitig
 * soft-detached. Erfolg: Toast + onSaved() + schließen; 403 als Klartext.
 */

const ROLE_ORDER: TeamRole[] = ["none", "coach", "skater"];

const ROLE_ACTIVE_CLASS: Record<TeamRole, string> = {
  none: "bg-sunken text-ink",
  coach: "bg-success-soft text-success",
  skater: "bg-info-soft text-info",
};

function RoleToggle({
  value,
  label,
  onChange,
  labels,
}: {
  value: TeamRole;
  label: string;
  onChange: (role: TeamRole) => void;
  labels: Record<TeamRole, string>;
}) {
  return (
    <div
      className="inline-flex flex-none overflow-hidden rounded-full border border-line"
      role="group"
      aria-label={label}
    >
      {ROLE_ORDER.map((role) => {
        const active = value === role;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(role)}
            className={`min-h-9 px-3 text-[12.5px] font-bold transition-colors duration-150 ${
              active ? ROLE_ACTIVE_CLASS[role] : "text-ink-faint hover:bg-sunken"
            }`}
          >
            {labels[role]}
          </button>
        );
      })}
    </div>
  );
}

function MemberRow({
  member,
  role,
  onChange,
  labels,
  roleLabel,
}: {
  member: Member;
  role: TeamRole;
  onChange: (role: TeamRole) => void;
  labels: Record<TeamRole, string>;
  roleLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="m" />
      <div className="grid min-w-0 flex-1">
        <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
        <span className="truncate text-[12px] text-ink-faint">
          {member.email ??
            (member.birthDate ? String(new Date(member.birthDate).getFullYear()) : "—")}
        </span>
      </div>
      <RoleToggle value={role} label={roleLabel} onChange={onChange} labels={labels} />
    </li>
  );
}

export function RosterDialog({
  team,
  members,
  onClose,
  onSaved,
}: {
  team: Team;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(teamsDict);
  const { showToast } = useToast();

  // Startbelegung aus dem aktuellen Kader — der Dialog wird pro Team frisch
  // gemountet (siehe TeamsClient), daher genügt der useState-Startwert.
  const [roles, setRoles] = useState<Record<string, TeamRole>>(() =>
    Object.fromEntries(initialRoles(team, members)),
  );
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(() => sortByName(members), [members]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((m) => fullName(m).toLowerCase().includes(needle));
  }, [sorted, query]);

  const roleLabels: Record<TeamRole, string> = {
    none: t("roleNone"),
    coach: t("roleCoach"),
    skater: t("roleSkater"),
  };

  const coachCount = Object.values(roles).filter((r) => r === "coach").length;
  const skaterCount = Object.values(roles).filter((r) => r === "skater").length;

  const setRole = (memberId: string, role: TeamRole) =>
    setRoles((current) => ({ ...current, [memberId]: role }));

  const save = async () => {
    if (submitting) return;
    const coachIds = Object.keys(roles).filter((id) => roles[id] === "coach");
    const skaterIds = Object.keys(roles).filter((id) => roles[id] === "skater");
    setSubmitting(true);
    try {
      await data.setTeamMembers(team.id, { coachIds, skaterIds });
      showToast(t("rosterSavedToast", { team: team.name }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = t("rosterSummary", {
    coaches: t(coachCount === 1 ? "coachesOne" : "coachesMany", { n: coachCount }),
    skaters: t(skaterCount === 1 ? "skatersOne" : "skatersMany", { n: skaterCount }),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("rosterEyebrow")}
      title={t("rosterTitle", { team: team.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={save} disabled={submitting}>
            {t("rosterSave")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-[13px] text-ink-soft">{t("rosterHint")}</p>

        {members.length === 0 ? (
          <p className="rounded-md bg-sunken px-4 py-3 text-[13px] text-ink-soft">
            {t("rosterNoMembers")}
          </p>
        ) : (
          <>
            <label className="relative flex min-h-11 items-center">
              <span className="sr-only">{t("rosterSearchLabel")}</span>
              <Icon
                name="search"
                className="ic pointer-events-none absolute left-4 h-4 w-4 text-ink-faint"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("rosterSearchPlaceholder")}
                className="min-h-11 w-full rounded-full border border-transparent bg-sunken pl-10 pr-4 text-body text-ink placeholder:text-ink-faint"
              />
            </label>

            <p className="text-caption font-semibold text-ink-faint" aria-live="polite">
              {summary}
            </p>

            {rows.length === 0 ? (
              <p className="px-1 py-3 text-[13px] text-ink-faint">{t("rosterEmpty")}</p>
            ) : (
              <ul className="grid divide-y divide-line">
                {rows.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    role={roles[member.id] ?? "none"}
                    onChange={(role) => setRole(member.id, role)}
                    labels={roleLabels}
                    roleLabel={t("rosterRoleLabel", { name: fullName(member) })}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
