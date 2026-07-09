import type { Club, Guardianship, Member, Team } from "@/lib/types";
import { dateFromNow } from "./util";

/**
 * EIN konsistenter Demo-Verein: RSV Neckarsulm.
 * 24 Mitglieder (realistische deutsche Namen mit Umlauten),
 * 3 Teams, Familien über guardianships.
 */

export const club: Club = {
  id: "club-rsv-neckarsulm",
  name: "RSV Neckarsulm",
  shortName: "RSV",
  city: "Neckarsulm",
  discipline: "Rollkunstlauf",
  foundedYear: 1968,
};

const c = club.id;

export const teams: Team[] = [
  { id: "t-01", clubId: c, name: "Minis & Anfänger", ageGroup: "U8–U10", coachIds: ["m-05"] },
  { id: "t-02", clubId: c, name: "Nachwuchs Pflicht", ageGroup: "U12–U15", coachIds: ["m-01", "m-05"] },
  { id: "t-03", clubId: c, name: "Kürgruppe Leistung", ageGroup: "U15+", coachIds: ["m-01", "m-06"] },
];

export const members: Member[] = [
  // Vorstand, Verwaltung & Trainerteam
  { id: "m-01", clubId: c, firstName: "Sandra", lastName: "Vogel", role: "coach", status: "active", email: "sandra.vogel@example.org", teamIds: ["t-02", "t-03"], joinedAt: "2015-09-01" },
  { id: "m-02", clubId: c, firstName: "Jürgen", lastName: "Häberle", role: "owner", status: "active", email: "juergen.haeberle@example.org", teamIds: [], joinedAt: "1998-03-15" },
  { id: "m-03", clubId: c, firstName: "Beate", lastName: "Schäfer", role: "treasurer", status: "active", email: "beate.schaefer@example.org", teamIds: [], joinedAt: "2006-01-10" },
  { id: "m-04", clubId: c, firstName: "Thomas", lastName: "Krüger", role: "admin", status: "active", email: "thomas.krueger@example.org", teamIds: [], joinedAt: "2011-05-02" },
  { id: "m-05", clubId: c, firstName: "Anna-Lena", lastName: "Böhm", role: "coach", status: "active", email: "annalena.boehm@example.org", teamIds: ["t-01", "t-02"], joinedAt: "2019-08-20" },
  { id: "m-06", clubId: c, firstName: "Milena", lastName: "Öztürk", role: "guest_coach", status: "active", email: "milena.oeztuerk@example.org", teamIds: ["t-03"], joinedAt: dateFromNow(-14), guestAccessUntil: dateFromNow(30) },

  // Familie Grünewald
  { id: "m-07", clubId: c, firstName: "Lina", lastName: "Grünewald", role: "member", status: "active", birthDate: "2014-04-12", teamIds: ["t-02"], joinedAt: "2021-09-01" },
  { id: "m-08", clubId: c, firstName: "Emma", lastName: "Grünewald", role: "member", status: "active", birthDate: "2016-11-03", teamIds: ["t-01"], joinedAt: "2023-03-01" },
  { id: "m-09", clubId: c, firstName: "Katrin", lastName: "Grünewald", role: "member", status: "active", email: "katrin.gruenewald@example.org", teamIds: [], joinedAt: "2021-09-01" },

  // Familie Müller
  { id: "m-10", clubId: c, firstName: "Sofia", lastName: "Müller", role: "member", status: "active", birthDate: "2013-02-27", teamIds: ["t-02"], joinedAt: "2020-01-15" },
  { id: "m-11", clubId: c, firstName: "Ben", lastName: "Müller", role: "member", status: "active", birthDate: "2015-07-19", teamIds: ["t-01"], joinedAt: "2022-04-01" },
  { id: "m-12", clubId: c, firstName: "Stefanie", lastName: "Müller", role: "member", status: "active", email: "stefanie.mueller@example.org", teamIds: [], joinedAt: "2020-01-15" },

  // Familie Köhler
  { id: "m-13", clubId: c, firstName: "Finn", lastName: "Köhler", role: "member", status: "active", birthDate: "2013-09-08", teamIds: ["t-02"], joinedAt: "2021-02-01" },
  { id: "m-14", clubId: c, firstName: "Petra", lastName: "Köhler", role: "member", status: "active", email: "petra.koehler@example.org", teamIds: [], joinedAt: "2021-02-01" },

  // Läuferinnen und Läufer
  { id: "m-15", clubId: c, firstName: "Leonie", lastName: "Schröder", role: "member", status: "active", birthDate: "2012-05-30", teamIds: ["t-02"], joinedAt: "2019-09-01" },
  { id: "m-16", clubId: c, firstName: "Maja", lastName: "Weiß", role: "member", status: "active", birthDate: "2011-01-22", teamIds: ["t-03"], joinedAt: "2018-09-01" },
  { id: "m-17", clubId: c, firstName: "Johanna", lastName: "Bär", role: "member", status: "active", birthDate: "2010-10-14", teamIds: ["t-03"], joinedAt: "2017-04-01" },
  { id: "m-18", clubId: c, firstName: "Charlotte", lastName: "Vogler", role: "member", status: "active", birthDate: "2009-06-05", teamIds: ["t-03"], joinedAt: "2016-09-01" },
  { id: "m-19", clubId: c, firstName: "Amelie", lastName: "Jäger", role: "member", status: "active", birthDate: "2012-12-01", teamIds: ["t-02"], joinedAt: "2020-09-01" },
  { id: "m-20", clubId: c, firstName: "Nele", lastName: "Hoffmann", role: "member", status: "active", birthDate: "2014-08-16", teamIds: ["t-01"], joinedAt: "2022-09-01" },
  { id: "m-21", clubId: c, firstName: "Marie", lastName: "Süß", role: "member", status: "active", birthDate: "2011-03-09", teamIds: ["t-03"], joinedAt: "2018-01-15" },
  { id: "m-22", clubId: c, firstName: "Lukas", lastName: "Öhler", role: "member", status: "active", birthDate: "2010-04-25", teamIds: ["t-03"], joinedAt: "2017-09-01" },
  { id: "m-23", clubId: c, firstName: "Hanna", lastName: "Förster", role: "member", status: "active", birthDate: "2008-09-13", teamIds: ["t-03"], joinedAt: "2015-09-01" },
  { id: "m-24", clubId: c, firstName: "Greta", lastName: "Lindner", role: "member", status: "pending", birthDate: "2015-06-21", teamIds: ["t-01"], joinedAt: dateFromNow(-5) },
];

export const guardianships: Guardianship[] = [
  { id: "g-01", guardianId: "m-09", childId: "m-07", relation: "parent" },
  { id: "g-02", guardianId: "m-09", childId: "m-08", relation: "parent" },
  { id: "g-03", guardianId: "m-12", childId: "m-10", relation: "parent" },
  { id: "g-04", guardianId: "m-12", childId: "m-11", relation: "parent" },
  { id: "g-05", guardianId: "m-14", childId: "m-13", relation: "parent" },
];

export function memberById(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

export function fullName(member: Member): string {
  return `${member.firstName} ${member.lastName}`;
}

/** Die eingeloggte Demo-Nutzerin des Portals. */
export const currentUser = members[0]; // Sandra Vogel — Trainerin
