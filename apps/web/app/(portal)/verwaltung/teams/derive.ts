import type { Member, Team } from "@/lib/types";

/**
 * Abgeleitete Sichten der Team-Verwaltung — REINE Funktionen über die per
 * Facade (lib/data) geladenen Arrays. Kein lib/mock-Import; alles wird hier
 * berechnet.
 *
 * Roster-Herleitung: `team.coach_member_ids`/`team.skater_member_ids` sind im
 * api-Modus maßgeblich. Der mock-Seed pflegt den Kader dagegen über
 * `member.teamIds` (team.skaterIds ist dort leer). Damit die Anzeige in BEIDEN
 * Datenquellen stimmt, zählt eine Person als Sportler:in, wenn sie im
 * skater-Set steht ODER das Team in ihren teamIds führt — und NICHT bereits
 * Trainer:in ist (bei Überschneidung gewinnt coach, wie serverseitig).
 */

export type TeamRole = "none" | "coach" | "skater";

export interface TeamRoster {
  coaches: Member[];
  skaters: Member[];
}

export function sortByName(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "de") ||
      a.firstName.localeCompare(b.firstName, "de"),
  );
}

export function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Aktueller Kader eines Teams, getrennt nach Trainerstab und Sportler:innen. */
export function rosterOf(team: Team, members: Member[]): TeamRoster {
  const coachSet = new Set(team.coachIds);
  const skaterSet = new Set(team.skaterIds);
  const coaches: Member[] = [];
  const skaters: Member[] = [];
  for (const member of members) {
    if (coachSet.has(member.id)) coaches.push(member);
    else if (skaterSet.has(member.id) || member.teamIds.includes(team.id)) {
      skaters.push(member);
    }
  }
  return { coaches: sortByName(coaches), skaters: sortByName(skaters) };
}

/** Startbelegung des Kader-Editors: memberId → Team-Rolle (VOLL-Replace-Basis). */
export function initialRoles(team: Team, members: Member[]): Map<string, TeamRole> {
  const { coaches, skaters } = rosterOf(team, members);
  const roles = new Map<string, TeamRole>();
  for (const coach of coaches) roles.set(coach.id, "coach");
  for (const skater of skaters) roles.set(skater.id, "skater");
  return roles;
}
