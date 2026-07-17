import * as mock from "@/lib/mock";
import type {
  Achievement,
  Attendance,
  Checkin,
  CompetitionEntry,
  Donation,
  DutyEntry,
  DutyRequirement,
  EffectiveConsent,
  EquipmentReservation,
  EventRsvp,
  Invoice,
  MemberAssessment,
  MemberDepartmentRef,
  MemberFee,
  MemberPhoto,
  MemberProfile,
  MemberRoleRef,
  Routine,
  RoutineScore,
  SepaMandate,
} from "@/lib/api/generated";
import type { Member, MemberRole } from "@/lib/types";
import type { CreateAssessmentInput, MemberProfileRepository } from "../inputs-memberprofile";
import { memberStore } from "./member-store";
import { mockViewer } from "./viewer";

/**
 * MOCK-Nachbau des 360-Grad-Aggregat-Endpunkts.
 *
 * Baut dieselbe Vertrags-Form (MemberProfile) wie der Server und wendet DIESELBE
 * Sichtbarkeits-Staffelung an — aus dem echten Endpunkt-Code gelesen, nicht
 * geraten (routes/member-profile.ts). Leitplanke: null = darf ich nicht (Sektion
 * ausblenden), [] / leeres Objekt = erlaubt, aber leer.
 *
 * Der Betrachter kommt aus mockViewer() (Demo-Umschalter). So zeigt die
 * Detailseite im Mock genau die rollenabhängigen Unterschiede, die der Server
 * live durchsetzt: Vorstand sieht alles, ein fremdes Mitglied wenig, ein
 * Elternteil das ganze Kind-Profil.
 */

const CLUB = mock.club.id;

/* --------------------------- Rollen-Mengen (Server-Spiegel) --------------------------- */
const MANAGE_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "treasurer"];
const ADMIN_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator"];
const TRAINER_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "coach", "guest_coach"];
const FINANCE_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "treasurer"];
const JOINED_ROLES: readonly MemberRole[] = ["owner", "admin", "moderator", "treasurer", "coach"];

const ROLE_NAME: Record<MemberRole, { de: string; en: string }> = {
  owner: { de: "Vorstand", en: "Board" },
  admin: { de: "Verwaltung", en: "Admin" },
  moderator: { de: "Moderation", en: "Moderator" },
  treasurer: { de: "Kassenwart", en: "Treasurer" },
  coach: { de: "Trainer:in", en: "Coach" },
  guest_coach: { de: "Gasttrainer:in", en: "Guest coach" },
  member: { de: "Mitglied", en: "Member" },
};

/* --------------------------- Beziehungen Betrachter × Ziel --------------------------- */

/** Trainert der/die Betrachter:in ein Team, in dem die Zielperson läuft? */
function coachesMember(viewer: Member, target: Member): boolean {
  return mock.teams.some(
    (team) => team.coachIds.includes(viewer.id) && target.teamIds.includes(team.id),
  );
}

/** Ist der/die Betrachter:in die Person selbst oder ein Elternteil? */
function selfOrGuardian(viewer: Member, target: Member): boolean {
  if (viewer.id === target.id) return true;
  return mock.guardianships.some((g) => g.childId === target.id && g.guardianId === viewer.id);
}

/* --------------------------- Synthetische Sektions-Rohdaten --------------------------- */
// Voll bestückt fuer WENIGE Personen (glaubwürdige Demo), leer fuer den Rest —
// so wie im echten Verein die meisten Profile dünn sind. Deterministische ISO-
// Daten (kein Zeit-Drift zwischen Screenshots).

const WAVE = Array.from({ length: 48 }, (_, i) =>
  Math.round((0.35 + 0.6 * Math.abs(Math.sin(i / 3.1)) * (0.6 + 0.4 * Math.sin(i / 11))) * 100) / 100,
);

type RawSections = {
  motto: string | null;
  discipline: string | null;
  skatingSince: number | null;
  phone: string | null;
  address: string | null;
  photoConsent: boolean;
  routines: Routine[];
  entries: CompetitionEntry[];
  scores: RoutineScore[];
  achievements: Achievement[];
  attendance: Attendance[];
  checkins: Checkin[];
  dutyRequirements: DutyRequirement[];
  dutyEntries: DutyEntry[];
  rsvps: EventRsvp[];
  equipment: EquipmentReservation[];
  invoices: Invoice[];
  memberFees: MemberFee[];
  sepa: SepaMandate[];
  donations: Donation[];
  assessments: MemberAssessment[];
  photos: MemberPhoto[];
  consents: EffectiveConsent[];
};

function emptySections(): RawSections {
  return {
    motto: null,
    discipline: null,
    skatingSince: null,
    phone: null,
    address: null,
    photoConsent: false,
    routines: [],
    entries: [],
    scores: [],
    achievements: [],
    attendance: [],
    checkins: [],
    dutyRequirements: [],
    dutyEntries: [],
    rsvps: [],
    equipment: [],
    invoices: [],
    memberFees: [],
    sepa: [],
    donations: [],
    assessments: [],
    photos: [],
    consents: [],
  };
}

const STAMP = "2026-07-01T09:00:00.000Z";

function consent(
  id: string,
  memberId: string,
  purpose: EffectiveConsent["purpose"],
  granted: boolean,
  byGuardian: boolean,
): EffectiveConsent {
  return {
    id,
    club_id: CLUB,
    member_id: memberId,
    subject_profile_id: null,
    purpose,
    granted_by_profile_id: "profile-demo",
    legal_document_id: null,
    policy_version: "2026-01",
    recorded_at: STAMP,
    effective: granted,
    recorded_granted: granted,
    granted_by_guardian: byGuardian,
    state: granted ? "valid" : "revoked",
  };
}

function photo(memberId: string, n: number, album: string, title: string): MemberPhoto {
  return {
    tag_id: `tag-${memberId}-${n}`,
    gallery_item_id: `gal-${memberId}-${n}`,
    member_id: memberId,
    album,
    title,
    kind: "photo",
    // CSP-sichere Inline-SVG-Data-URI (kein externer Request) — warmer Verlauf.
    storage_key: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="hsl(${(n * 47 + 320) % 360},64%,60%)"/>` +
        `<stop offset="1" stop-color="hsl(${(n * 47 + 358) % 360},58%,42%)"/></linearGradient></defs>` +
        `<rect width="320" height="240" fill="url(#g)"/>` +
        `<circle cx="160" cy="96" r="46" fill="rgba(255,255,255,0.22)"/>` +
        `<rect x="96" y="150" width="128" height="60" rx="30" fill="rgba(255,255,255,0.18)"/></svg>`,
    )}`,
    content_type: "image/svg+xml",
    thumbnail_key: null,
    tagged_at: STAMP,
  };
}

/** Vollprofil der Star-Person Lina Grünewald (m-07, Kind, Team t-02). */
function linaSections(): RawSections {
  const s = emptySections();
  s.motto = "Kür zu Filmmusik — und irgendwann der Doppel-Rittberger.";
  s.discipline = "Kür (Einzel)";
  s.skatingSince = 2021;
  s.phone = "+49 7132 123456";
  s.address = "Rosenweg 4, 74172 Neckarsulm";
  s.photoConsent = true;

  s.routines = [
    {
      id: "r-lina-01",
      club_id: CLUB,
      team_id: "t-02",
      title: "Kür 2026 — „Cinema Paradiso“",
      status: "competition",
      category: "Nachwuchs Kür",
      music_title: "Cinema Paradiso (Love Theme)",
      music_artist: "Ennio Morricone",
      music_bpm: 92,
      music_duration_ms: 150_000,
      audio_asset_id: "audio-lina-01",
      image_asset_id: "img-lina-01",
      skater_member_ids: ["m-07"],
      waveform_peaks: WAVE,
      created_at: "2026-02-10T10:00:00.000Z",
      updated_at: STAMP,
    },
  ];
  s.entries = [
    { id: "ce-lina-01", member_id: "m-07", routine_id: "r-lina-01", status: "confirmed" },
    { id: "ce-lina-02", member_id: "m-07", routine_id: "r-lina-01", status: "registered" },
  ];
  // Notenverlauf über die Saison — der TREND ist der motivierende Wert.
  const scoreRows: Array<[string, string, number, number, number, number]> = [
    ["rs-l1", "2025-11-15", 22.1, 16.3, 38.4, 5],
    ["rs-l2", "2026-01-24", 23.8, 16.75, 40.55, 4],
    ["rs-l3", "2026-03-14", 24.9, 17.9, 42.8, 3],
    ["rs-l4", "2026-05-30", 25.6, 18.5, 44.1, 2],
  ];
  s.scores = scoreRows.map(([id, on, tech, comp, total, place]) => ({
    id,
    club_id: CLUB,
    routine_id: "r-lina-01",
    competition_id: null,
    scored_on: on,
    scoring_system: "RollArt",
    technical_score: tech,
    components_score: comp,
    total_score: total,
    placement: place,
    note: place <= 3 ? "Sauberer Lauf, starke Präsenz." : null,
  }));
  s.achievements = [
    {
      id: "ach-l1",
      club_id: CLUB,
      member_id: "m-07",
      title: "Bezirksmeisterschaft Nachwuchs",
      competition_name: "Bezirksmeisterschaft Nordwürttemberg 2026",
      placement: 2,
      medal: "silver",
      achieved_on: "2026-05-30",
      note: "Persönliche Bestleistung: 44,10 Punkte.",
      created_at: STAMP,
      updated_at: STAMP,
    },
    {
      id: "ach-l2",
      club_id: CLUB,
      member_id: "m-07",
      title: "Nikolauspokal",
      competition_name: "Nikolauspokal Neckarsulm 2025",
      placement: 1,
      medal: "gold",
      achieved_on: "2025-12-06",
      note: null,
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  const attRows: Array<[string, string, Attendance["status"]]> = [
    ["at-l1", "2026-06-24", "present"],
    ["at-l2", "2026-06-21", "present"],
    ["at-l3", "2026-06-17", "late"],
    ["at-l4", "2026-06-14", "present"],
    ["at-l5", "2026-06-10", "present"],
    ["at-l6", "2026-06-07", "excused"],
    ["at-l7", "2026-06-03", "present"],
    ["at-l8", "2026-05-31", "present"],
    ["at-l9", "2026-05-27", "absent"],
    ["at-l10", "2026-05-24", "present"],
    ["at-l11", "2026-05-20", "present"],
    ["at-l12", "2026-05-17", "present"],
  ];
  s.attendance = attRows.map(([id, day, status]) => ({
    id,
    club_id: CLUB,
    event_id: `ev-${id}`,
    member_id: "m-07",
    status,
    checked_in_at: status === "absent" || status === "excused" ? null : `${day}T16:32:00.000Z`,
  }));
  s.checkins = [
    { id: "ci-l1", club_id: CLUB, member_id: "m-07", event_id: "ev-at-l1", method: "qr", checked_in_at: "2026-06-24T16:31:00.000Z", created_at: STAMP },
    { id: "ci-l2", club_id: CLUB, member_id: "m-07", event_id: "ev-at-l2", method: "qr", checked_in_at: "2026-06-21T16:30:00.000Z", created_at: STAMP },
    { id: "ci-l3", club_id: CLUB, member_id: "m-07", event_id: "ev-at-l4", method: "manual", checked_in_at: "2026-06-14T16:35:00.000Z", created_at: STAMP },
  ];
  s.dutyRequirements = [
    {
      id: "dr-l1",
      club_id: CLUB,
      team_id: "t-02",
      member_id: null,
      season_label: "Saison 2025/26",
      required_hours: 10,
      period_start: "2025-09-01",
      period_end: "2026-08-31",
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  const dutyRows: Array<[string, string, number, DutyEntry["kind"], string, boolean]> = [
    ["de-l1", "2026-03-08", 3, "helper", "Kuchenverkauf Bezirkspokal", true],
    ["de-l2", "2026-04-19", 2.5, "helper", "Auf-/Abbau Frühjahrsschau", true],
    ["de-l3", "2026-06-13", 2, "competition", "Helferdienst Vereinsmeisterschaft", false],
  ];
  s.dutyEntries = dutyRows.map(([id, day, hours, kind, note, approved]) => ({
    id,
    club_id: CLUB,
    member_id: "m-07",
    hours,
    activity_date: day,
    kind,
    note,
    approved,
    created_at: STAMP,
    updated_at: STAMP,
  }));
  const rsvpRows: Array<[string, string, EventRsvp["status"], string | null]> = [
    ["rv-l1", "2026-07-12", "going", null],
    ["rv-l2", "2026-07-05", "going", null],
    ["rv-l3", "2026-06-28", "sick", "Erkältung, nächste Woche wieder dabei."],
    ["rv-l4", "2026-06-21", "maybe", "Kommt auf die Fahrgemeinschaft an."],
    ["rv-l5", "2026-06-14", "declined", null],
  ];
  s.rsvps = rsvpRows.map(([id, day, status, comment]) => ({
    id,
    club_id: CLUB,
    event_id: `ev-${id}`,
    member_id: "m-07",
    status,
    comment,
    responded_at: `${day}T18:00:00.000Z`,
  }));
  s.equipment = [
    {
      id: "eq-l1",
      equipment_id: "equ-01",
      club_id: CLUB,
      reserved_by_member_id: "m-07",
      quantity: 1,
      from_at: "2026-05-28T00:00:00.000Z",
      to_at: "2026-06-01T00:00:00.000Z",
      status: "returned",
      created_at: STAMP,
      updated_at: STAMP,
    },
    {
      id: "eq-l2",
      equipment_id: "equ-04",
      club_id: CLUB,
      reserved_by_member_id: "m-07",
      quantity: 1,
      from_at: "2026-07-10T00:00:00.000Z",
      to_at: "2026-07-14T00:00:00.000Z",
      status: "active",
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  s.invoices = [
    {
      id: "inv-l1",
      club_id: CLUB,
      member_id: "m-07",
      number: "R-2026-0087",
      title: "Mitgliedsbeitrag Q2/2026",
      amount_cents: 4500,
      currency: "EUR",
      status: "paid",
      dunning_level: 0,
      issued_on: "2026-04-01",
      due_on: "2026-04-15",
      paid_at: "2026-04-09T10:00:00.000Z",
      paid_via: "SEPA",
      created_at: STAMP,
      updated_at: STAMP,
    },
    {
      id: "inv-l2",
      club_id: CLUB,
      member_id: "m-07",
      number: "R-2026-0142",
      title: "Wettkampfgebühr Bezirksmeisterschaft",
      amount_cents: 2500,
      currency: "EUR",
      status: "open",
      dunning_level: 1,
      issued_on: "2026-06-02",
      due_on: "2026-06-16",
      paid_at: null,
      paid_via: null,
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  s.memberFees = [
    {
      id: "mf-l1",
      club_id: CLUB,
      member_id: "m-07",
      category_id: "cat-nachwuchs",
      custom_amount_cents: null,
      valid_from: "2025-09-01",
      valid_until: null,
      created_at: STAMP,
      updated_at: STAMP,
      deleted_at: null,
      category_name: "Nachwuchs (Kür)",
      category_amount_cents: 4500,
      category_period: "quarterly",
    },
  ];
  s.sepa = [
    {
      id: "sep-l1",
      club_id: CLUB,
      member_id: "m-07",
      mandate_reference: "RSV-2021-0207",
      iban_last4: "4711",
      account_holder: "Katrin Grünewald",
      signed_on: "2021-09-01",
      status: "active",
      created_at: STAMP,
      updated_at: STAMP,
      deleted_at: null,
    },
  ];
  s.assessments = [
    {
      id: "as-l1",
      club_id: CLUB,
      member_id: "m-07",
      author_member_id: "m-01",
      body: "Lina arbeitet konzentriert an der Laufsicherheit. Die Präsenz auf dem Parkett ist stark gewachsen — der Ausdruck trägt die Kür inzwischen selbst.",
      rating_technik: 4,
      rating_ausdruck: 5,
      assessed_on: "2026-06-05",
      created_at: STAMP,
      updated_at: STAMP,
    },
    {
      id: "as-l2",
      club_id: CLUB,
      member_id: "m-07",
      author_member_id: "m-05",
      body: "Sprünge werden zuverlässiger, der Rittberger steht meist. Nächster Schritt: die Landungen weicher abfangen.",
      rating_technik: 4,
      rating_ausdruck: 4,
      assessed_on: "2026-04-18",
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  s.photos = [
    photo("m-07", 1, "Bezirksmeisterschaft 2026", "Siegerehrung — Silber"),
    photo("m-07", 2, "Frühjahrsschau", "Kür-Finale „Cinema Paradiso“"),
    photo("m-07", 3, "Training", "Standwaage im Abschlusstraining"),
  ];
  s.consents = [
    consent("cn-l1", "m-07", "terms", true, true),
    consent("cn-l2", "m-07", "privacy", true, true),
    consent("cn-l3", "m-07", "photos_internal", true, true),
    consent("cn-l4", "m-07", "photos_public", false, true),
    consent("cn-l5", "m-07", "chat", true, true),
  ];
  return s;
}

/** Leichtes Profil einer Läuferin (m-16 Maja) — Erfolge, RSVPs, Galerie mit Einwilligung. */
function majaSections(): RawSections {
  const s = emptySections();
  s.photoConsent = true;
  s.achievements = [
    {
      id: "ach-m1",
      club_id: CLUB,
      member_id: "m-16",
      title: "Vereinsmeisterin Kür U15",
      competition_name: "Vereinsmeisterschaft RSV 2026",
      placement: 1,
      medal: "gold",
      achieved_on: "2026-06-13",
      note: null,
      created_at: STAMP,
      updated_at: STAMP,
    },
  ];
  s.rsvps = [
    { id: "rv-m1", club_id: CLUB, event_id: "ev-rv-m1", member_id: "m-16", status: "going", comment: null, responded_at: "2026-07-08T18:00:00.000Z" },
    { id: "rv-m2", club_id: CLUB, event_id: "ev-rv-m2", member_id: "m-16", status: "maybe", comment: null, responded_at: "2026-07-01T18:00:00.000Z" },
  ];
  s.photos = [photo("m-16", 1, "Vereinsmeisterschaft", "Standwaage im Finale")];
  return s;
}

const SECTION_BUILDERS: Record<string, () => RawSections> = {
  "m-07": linaSections,
  "m-16": majaSections,
};

/** In-Memory-Beurteilungen, die im Mock zur Laufzeit geschrieben wurden. */
const writtenAssessments: MemberAssessment[] = [];

function rawFor(memberId: string): RawSections {
  const base = (SECTION_BUILDERS[memberId] ?? emptySections)();
  const extra = writtenAssessments.filter((a) => a.member_id === memberId);
  if (extra.length > 0) {
    base.assessments = [...extra, ...base.assessments].sort((a, b) =>
      b.assessed_on.localeCompare(a.assessed_on),
    );
  }
  return base;
}

/* --------------------------- Zusammenbau + Gates --------------------------- */

function rolesRef(member: Member): MemberRoleRef[] {
  const name = ROLE_NAME[member.role];
  return [{ role_id: `role-${member.role}`, key: member.role, name_de: name.de, name_en: name.en }];
}

function departmentsRef(member: Member): MemberDepartmentRef[] {
  if (member.role === "owner") {
    return [{ id: "dep-vorstand", name: "Vorstand", is_lead: true }];
  }
  if (member.id === "m-07") {
    return [{ id: "dep-schau", name: "Schaulaufen-Gruppe", is_lead: false }];
  }
  return [];
}

export const moduleRepositoryMemberProfile: MemberProfileRepository = {
  async getMemberProfile(memberId): Promise<MemberProfile> {
    const target = memberStore.find((m) => m.id === memberId);
    if (!target) {
      // Kein solches Mitglied — dieselbe Semantik wie der Server (404).
      throw new Error(`Mitglied ${memberId} nicht gefunden (mock)`);
    }
    const viewer = mockViewer();
    const raw = rawFor(memberId);

    // --- Betrachter-Gates (Server-Spiegel, aus member-profile.ts gelesen) ---
    const privileged = MANAGE_ROLES.includes(viewer.role); // can_manage_members
    const isAdmin = ADMIN_ROLES.includes(viewer.role);
    const isTrainer = TRAINER_ROLES.includes(viewer.role);
    const isFinance = FINANCE_ROLES.includes(viewer.role);
    const joinedOnVisible = JOINED_ROLES.includes(viewer.role);
    const internalSelfViewer = isTrainer || privileged;

    const sog = selfOrGuardian(viewer, target);
    const coachOf = coachesMember(viewer, target);

    const contactVisible = privileged || coachOf || sog;
    const adminContactVisible = privileged;
    const visibility: "public" | "internal" = target.id === "m-16" ? "public" : "internal";
    const selfProfileVisible = internalSelfViewer || sog || visibility === "public";
    const routineReader = isAdmin || coachOf || sog;
    const trainerOrFamily = isTrainer || sog;
    const attendanceVisible = isTrainer || sog;
    const financeVisible = isFinance || sog;
    const canReadRsvpReason = isAdmin || coachOf || sog;

    // --- Stammkopf (redigiert) ---
    const member = {
      id: target.id,
      club_id: CLUB,
      profile_id: adminContactVisible ? `profile-${target.id}` : null,
      first_name: target.firstName,
      last_name: target.lastName,
      email: contactVisible ? (target.email ?? null) : null,
      birth_date: contactVisible ? (target.birthDate ?? null) : null,
      phone: contactVisible ? raw.phone : null,
      postal_address: contactVisible ? raw.address : null,
      role: target.role,
      status: target.status,
      joined_on: joinedOnVisible ? (target.joinedAt || null) : null,
      valid_until: adminContactVisible ? (target.guestAccessUntil ?? null) : null,
      avatar_url: target.avatarUrl ?? null,
      team_ids: [...target.teamIds],
      profile_motto: selfProfileVisible ? raw.motto : null,
      profile_favorite_discipline: selfProfileVisible ? raw.discipline : null,
      profile_skating_since: selfProfileVisible ? raw.skatingSince : null,
      profile_visibility: visibility,
      created_at: STAMP,
      updated_at: STAMP,
      // about_me ist NICHT sensibel (freiwilliger, für alle sichtbarer Text) —
      // Wire-Feld existiert, im Codegen-Typ noch nicht; über Cast angehängt.
      about_me: target.aboutMe ?? null,
    } as MemberProfile["member"];

    // 'sick'-Grund maskieren, sofern nicht can_read_rsvp_reason.
    const rsvps: EventRsvp[] = raw.rsvps.map((r) =>
      r.status === "sick" && !canReadRsvpReason ? { ...r, comment: null } : r,
    );

    return {
      member,
      contact_visible: contactVisible,
      admin_contact_visible: adminContactVisible,
      self_profile_visible: selfProfileVisible,
      joined_on_visible: joinedOnVisible,
      roles: rolesRef(target),
      departments: departmentsRef(target),
      routines: routineReader ? raw.routines : null,
      competition: routineReader ? { entries: raw.entries, scores: raw.scores } : undefined,
      achievements: raw.achievements,
      attendance: attendanceVisible ? raw.attendance : null,
      checkins: trainerOrFamily ? raw.checkins : null,
      duty: trainerOrFamily
        ? { requirements: raw.dutyRequirements, entries: raw.dutyEntries }
        : undefined,
      rsvps,
      equipment: trainerOrFamily ? raw.equipment : null,
      finance: financeVisible
        ? {
            invoices: raw.invoices,
            member_fees: raw.memberFees,
            sepa_mandates: raw.sepa,
            donations: raw.donations,
          }
        : undefined,
      assessments: privileged || coachOf || sog ? raw.assessments : null,
      photos: raw.photoConsent ? raw.photos : null,
      consents: privileged || sog ? raw.consents : null,
    };
  },

  async createMemberAssessment(input: CreateAssessmentInput): Promise<MemberAssessment> {
    const viewer = mockViewer();
    const created: MemberAssessment = {
      id: `as-local-${Date.now()}`,
      club_id: CLUB,
      member_id: input.memberId,
      author_member_id: viewer.id,
      body: input.body,
      rating_technik: input.ratingTechnik ?? null,
      rating_ausdruck: input.ratingAusdruck ?? null,
      assessed_on: input.assessedOn ?? new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writtenAssessments.unshift(created);
    return created;
  },
};
