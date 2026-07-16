"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Id, Member, Team } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { rollenDict } from "./i18n";
import { sortMembers } from "./derive";

/**
 * TRAINER:IN ↔ MEHRERE TEAMS (RBAC-DESIGN §1.4).
 *
 * ### Die Richtung ist umgedreht — und das ist der Punkt ###
 * Der Server kennt nur „die Trainer:innen EINES Teams" (PUT
 * .../teams/{teamId}/coaches). Die Anforderung lautet aber „für EINEN Trainer
 * mehrere Teams einstellen können". Diese Ansicht dreht das um: sie zeigt je
 * PERSON die Teams, und speichert die Änderung als ein PUT je BETROFFENEM Team
 * — nur für die Teams, bei denen sich wirklich etwas ändert.
 *
 * ### Warum es keine Tabelle team_coaches gibt ###
 * app.team_coaches ist eine VIEW auf team_members(role='coach') (0025:202). Es
 * gibt also keine zweite Wahrheit, die man pflegen müsste — und ein Team-Roster
 * hat je Person genau eine Zeile: wer dort Skater:in ist, kann nicht zusätzlich
 * Trainer:in sein (409, roles.ts:629). Genau das steht als Hinweis im Sheet.
 *
 * ### Wer darf das? ###
 * `team_coaches:manage`, NICHT `teams:manage` (0031). Der Unterschied ist der
 * ganze Grund für 0031: `teams:manage` trägt der Coach selbst — damit konnte
 * sich eine Trainerin einem FREMDEN Team zuordnen (live belegt: HTTP 200) und
 * sah danach dessen Küren.
 */

function TeamsSheet({
  coach,
  teams,
  onClose,
  onSaved,
}: {
  coach: Member;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(rollenDict);
  const { showToast } = useToast();
  const initial = new Set(teams.filter((team) => team.coachIds.includes(coach.id)).map((x) => x.id));
  const [selected, setSelected] = useState<Set<Id>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (teamId: Id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Nur die Teams anfassen, bei denen sich etwas ändert. Ein PUT auf jedes
      // Team wäre nicht nur verschwenderisch: es würde fremde Trainer-Listen
      // neu schreiben und dabei fremde Nebenwirkungen riskieren.
      for (const team of teams) {
        const was = team.coachIds.includes(coach.id);
        const now = selected.has(team.id);
        if (was === now) continue;
        const next = now
          ? [...team.coachIds, coach.id]
          : team.coachIds.filter((id) => id !== coach.id);
        await data.setTeamCoaches(team.id, next);
      }
      showToast(t("teamsSaved", { name: fullName(coach) }), { tone: "success" });
      onSaved();
      onClose();
    } catch (err) {
      // 409 „ist dort schon Skater:in" ist hier die erwartbare Antwort — sie
      // gehört als Satz an die Auswahl, nicht in einen Toast, der wegfliegt.
      setError(isForbidden(err) ? t("toastForbidden") : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("coachesEyebrow")}
      title={t("editTeamsTitle", { name: fullName(coach) })}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("roleCancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {t("roleSave")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <p className="text-[13px] text-ink-soft">{t("editTeamsSub")}</p>
        <ul className="grid gap-1.5">
          {teams.map((team) => {
            // Wer im Team Skater:in ist, kann dort nicht Trainer:in sein — das
            // Kästchen gar nicht erst anbieten, statt in den 409 zu laufen.
            const isSkater = team.skaterIds.includes(coach.id);
            return (
              <li key={team.id}>
                <label
                  className={`flex items-center gap-3 rounded-lg border border-line px-3.5 py-2.5 ${
                    isSkater ? "opacity-55" : "cursor-pointer hover:bg-sunken"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(team.id)}
                    onChange={() => toggle(team.id)}
                    disabled={submitting || isSkater}
                    className="h-4 w-4 flex-none accent-[var(--brand)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-bold text-ink">{team.name}</span>
                    {team.ageGroup && <Badge tone="neutral">{team.ageGroup}</Badge>}
                    {isSkater && (
                      <Badge tone="warn" icon="lock">
                        {t("isSkaterHere")}
                      </Badge>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function CoachTeams({
  members,
  teams,
  canManage,
  onChanged,
}: {
  members: Member[];
  teams: Team[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT(rollenDict);
  const [sheetFor, setSheetFor] = useState<Member | null>(null);

  // Angezeigt wird JEDE Person, die schon ein Team betreut — plus alle, die als
  // Trainer:in/Gasttrainer:in geführt sind. Die Rolle ist hier nur der
  // Vorschlag: zugeordnet werden darf auch jemand anders (der Server entscheidet).
  const rows = sortMembers(
    members.filter(
      (m) =>
        m.role === "coach" ||
        m.role === "guest_coach" ||
        teams.some((team) => team.coachIds.includes(m.id)),
    ),
  );

  const coachCell: Column<Member> = {
    id: "coach",
    header: t("colCoach"),
    cell: (member) => (
      <span className="flex min-w-44 items-center gap-2.5">
        <Avatar
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          size="m"
        />
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold leading-tight text-ink">
            {fullName(member)}
          </span>
          <span className="truncate text-[12px] text-ink-faint">{member.email ?? "—"}</span>
        </span>
      </span>
    ),
  };

  const teamsCell: Column<Member> = {
    id: "teams",
    header: t("colTeams"),
    cell: (member) => {
      const mine = teams.filter((team) => team.coachIds.includes(member.id));
      if (mine.length === 0) {
        return <span className="text-[13px] text-ink-faint">{t("noTeams")}</span>;
      }
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          {mine.map((team) => (
            <StatusPill key={team.id} tone="success">
              {team.name}
            </StatusPill>
          ))}
        </span>
      );
    },
  };

  const editCell: Column<Member> = {
    id: "edit",
    header: t("colEdit"),
    align: "right",
    cell: (member) => (
      <Button variant="ghost" size="sm" icon="edit" onClick={() => setSheetFor(member)}>
        {t("editTeams")}
      </Button>
    ),
  };

  const columns: Column<Member>[] = canManage
    ? [coachCell, teamsCell, editCell]
    : [coachCell, teamsCell];

  return (
    <Card>
      <CardHeader eyebrow={t("coachesEyebrow")} title={t("coachesTitle")} />
      <p className="mb-4 text-[13px] text-ink-soft">{t("coachesSub")}</p>
      <p className="mb-4 flex items-start gap-2 rounded-lg bg-info-soft px-4 py-3 text-[13px] text-info">
        <Icon name="shield" className="ic mt-0.5 h-4 w-4 flex-none" />
        {t("coachSelfNote")}
      </p>
      {!canManage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-info">
          <Icon name="lock" className="ic mt-0.5 h-4 w-4 flex-none" />
          <span className="grid gap-0.5">
            <span className="text-[13.5px] font-bold">{t("lockedTitle")}</span>
            <span className="text-[13px]">{t("lockedBody")}</span>
          </span>
        </div>
      )}
      {teams.length === 0 ? (
        <EmptyState icon="teams" title={t("coachesEmptyTitle")} body={t("coachesEmptyBody")} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(member) => member.id}
          caption={t("coachesTableCaption")}
          empty={<EmptyState icon="members" title={t("emptyTitle")} body={t("emptyBody")} />}
        />
      )}
      {sheetFor && (
        <TeamsSheet
          coach={sheetFor}
          teams={teams}
          onClose={() => setSheetFor(null)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}
