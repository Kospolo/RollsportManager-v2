import type { Member, Team } from "@/lib/types";

/**
 * Abgeleitete Sichten der Teams-Mitgliederansicht — REINE Funktionen über die
 * per Facade (lib/data) geladenen Arrays (getTeams/getMembers/getCurrentUser).
 * Kein lib/mock-Import; alles wird hier berechnet.
 *
 * Roster-Herleitung analog zur Team-Verwaltung: im api-Modus zählen
 * `team.coachIds`/`team.skaterIds`, der mock-Seed pflegt den Kader dagegen über
 * `member.teamIds`. Damit die Anzeige in BEIDEN Datenquellen stimmt, gilt eine
 * Person als Sportler:in, wenn sie im skater-Set steht ODER das Team in ihren
 * teamIds führt — und NICHT bereits Trainer:in ist (coach gewinnt, wie
 * serverseitig).
 */

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

/**
 * Gehört das eingeloggte Mitglied zu diesem Team — als Trainer:in ODER
 * Sportler:in? Deckt beide Datenquellen ab (coach/skater-Set und teamIds).
 */
export function isMyTeam(team: Team, me: Pick<Member, "id" | "teamIds">): boolean {
  return (
    team.coachIds.includes(me.id) ||
    team.skaterIds.includes(me.id) ||
    me.teamIds.includes(team.id)
  );
}
