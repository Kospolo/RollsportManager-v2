import type * as M from "@/lib/api/generated";
import type {
  Attendance,
  Club,
  Competition,
  CompetitionStatus,
  DunningLevel,
  Event,
  Exercise,
  Guardianship,
  Invoice,
  LedgerEntry,
  Member,
  MemberStatus,
  MyProfile,
  MyProfileMembership,
  News,
  Note,
  UserPreferences,
  PlatformClubSummary,
  PlatformStats,
  PlatformUserSummary,
  Routine,
  RoutineMarker,
  RollArtScore,
  Rsvp,
  Task,
  Team,
} from "@/lib/types";
import { waveformPeaks } from "@/lib/mock/util";
import { API_BASE_URL } from "../config";

/**
 * Relative Media-URL (`/media/<key>`) mit der API-Basis präfixen — analog zu den
 * übrigen Media-Downloads. Absolute URLs bleiben unangetastet; null/leer → undefined.
 */
export function mediaUrl(rel: string | null | undefined): string | undefined {
  if (!rel) return undefined;
  return /^https?:\/\//.test(rel) ? rel : `${API_BASE_URL}${rel}`;
}

/**
 * Mapper: API-Wire-Format (snake_case, Blueprint ADR-E7) → View-Typen
 * (lib/types, camelCase). Seit Contract v0.2.0 liefert die API die vollen
 * Read-Modelle (Teams, Familien, RSVPs, Anwesenheit, Kassenbuch, Wettkämpfe,
 * Aufgaben, Läufer:innen). Einzige verbleibende Lücke:
 *
 *  - Routine.waveformPeaks: hat eine Kür kein Audio-Asset (waveform_peaks
 *    null), wird ein deterministischer Anzeige-PLATZHALTER aus der
 *    Routine-ID erzeugt — klar als solcher markiert.
 */

export function mapClub(w: M.Club): Club {
  return {
    id: w.id,
    name: w.name,
    shortName: w.short_name ?? w.name,
    city: w.city ?? "",
    discipline: w.discipline ?? "",
    foundedYear: w.founded_year ?? 0,
    // Logo (0060): die oeffentliche Serve-Route + Cache-Buster ueber die
    // Asset-Id, damit ein Wechsel (neue Asset-Id) nicht am Browser-Cache
    // haengenbleibt. Kein Logo -> null (Ansicht zeigt Initialen).
    logoUrl: w.logo_asset_id
      ? `${API_BASE_URL}/public/clubs/${w.id}/logo?v=${w.logo_asset_id}`
      : null,
  };
}

function mapMemberStatus(s: M.MemberStatus): MemberStatus {
  // View-Modell kennt kein "left" — für die Anzeige zählt das als inaktiv.
  if (s === "left") return "inactive";
  return s;
}

/**
 * Selbst-Profil aus dem Wire-Objekt lesen. Das Feld `about_me` ergänzt gerade
 * der Backend-Trupp; solange die GENERIERTEN Contract-Typen es nicht kennen,
 * geht es nur über diesen eng gefassten Cast (Contracts werden bewusst NICHT
 * hier regeneriert — das macht der Zusammenführer einmal).
 *
 * ⚠️ NACH der Regenerierung: Cast entfernen und direkt `w.about_me` lesen.
 * Leerstring → undefined, damit „eingetragen, aber leer" nicht als Eintrag gilt.
 */
function aboutMeOf(w: unknown): string | undefined {
  const value = (w as { about_me?: string | null }).about_me;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

export function mapMember(w: M.ClubMember): Member {
  return {
    id: w.id,
    clubId: w.club_id,
    firstName: w.first_name,
    lastName: w.last_name,
    role: w.role,
    status: mapMemberStatus(w.status),
    birthDate: w.birth_date ?? undefined,
    email: w.email ?? undefined,
    teamIds: w.team_ids,
    joinedAt: w.joined_on ?? w.created_at.slice(0, 10),
    guestAccessUntil: w.role === "guest_coach" ? (w.valid_until ?? undefined) : undefined,
    avatarUrl: mediaUrl(w.avatar_url),
    aboutMe: aboutMeOf(w),
  };
}

export function mapRsvp(w: M.EventRsvp): Rsvp {
  return {
    memberId: w.member_id,
    status: w.status,
    comment: w.comment ?? undefined,
    respondedAt: w.responded_at,
  };
}

export function mapEvent(w: M.Event): Event {
  return {
    id: w.id,
    clubId: w.club_id,
    type: w.type,
    title: w.title,
    location: w.location ?? "",
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    audience: w.audience,
    teamIds: w.team_ids,
    rsvps: w.rsvps.map(mapRsvp),
    note: w.note ?? undefined,
    competitionId: w.competition_id ?? undefined,
  };
}

export function mapTeam(w: M.Team): Team {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    ageGroup: w.age_group ?? "",
    coachIds: w.coach_member_ids,
    skaterIds: w.skater_member_ids,
  };
}

export function mapPlatformClub(w: M.PlatformClub): PlatformClubSummary {
  return {
    id: w.id,
    name: w.name,
    shortName: w.short_name ?? w.name,
    city: w.city ?? "",
    discipline: w.discipline ?? "",
    memberCount: w.member_count ?? 0,
    logoUrl: w.logo_asset_id
      ? `${API_BASE_URL}/public/clubs/${w.id}/logo?v=${w.logo_asset_id}`
      : null,
    createdAt: w.created_at,
  };
}

export function mapPlatformUser(w: M.PlatformUser): PlatformUserSummary {
  return {
    id: w.id,
    displayName: w.display_name ?? "",
    locale: w.locale,
    clubCount: w.club_count ?? 0,
    createdAt: w.created_at,
  };
}

export function mapPlatformStats(w: M.PlatformStats): PlatformStats {
  return {
    clubs: w.clubs ?? 0,
    users: w.users ?? 0,
    members: w.members ?? 0,
    activeMembers: w.active_members ?? 0,
    teams: w.teams ?? 0,
    events: w.events ?? 0,
    openInvoices: w.open_invoices ?? 0,
  };
}

export function mapGuardianship(w: M.Guardianship): Guardianship {
  // DB-Relation ist Freitext (parent | guardian | other) — das View-Modell
  // kennt parent | grandparent | other; Unbekanntes wird "other".
  const relation =
    w.relation === "parent" || w.relation === "grandparent" ? w.relation : "other";
  return {
    id: w.id,
    guardianId: w.guardian_member_id,
    childId: w.child_member_id,
    relation,
  };
}

export function mapAttendance(w: M.Attendance): Attendance {
  return {
    id: w.id,
    eventId: w.event_id,
    memberId: w.member_id,
    status: w.status,
    checkedInAt: w.checked_in_at ?? undefined,
  };
}

export function mapLedgerEntry(w: M.LedgerEntry): LedgerEntry {
  return {
    id: w.id,
    clubId: w.club_id,
    date: w.entry_on,
    description: w.description,
    counterparty:
      w.counterparty_kind === "person" && w.counterparty_member_id
        ? { kind: "person", memberId: w.counterparty_member_id }
        : { kind: "org", name: w.counterparty_name ?? "—" },
    // z.coerce macht das Feld im Spec nullable (wie Invoice.amount_cents) —
    // die DB-Spalte ist NOT NULL, 0 ist reiner Typ-Fallback.
    amountCents: w.amount_cents ?? 0,
    category: w.category ?? "",
    categoryId: w.category_id ?? undefined,
    categoryName: w.category_name ?? undefined,
    categoryKind: w.category_kind,
    invoiceId: w.invoice_id ?? undefined,
    reversesEntryId: w.reverses_entry_id ?? undefined,
  };
}

export function mapCompetition(w: M.Competition): Competition {
  // View-Modell kennt kein "cancelled" — für die Anzeige zählt das als done.
  const status: CompetitionStatus = w.status === "cancelled" ? "done" : w.status;
  const active = w.entries.filter((e) => e.status !== "withdrawn");
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    location: w.location ?? "",
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    registrationDeadline: w.registration_deadline ?? undefined,
    status,
    participantIds: active.map((e) => e.member_id),
    routineIds: [...new Set(active.flatMap((e) => (e.routine_id ? [e.routine_id] : [])))],
  };
}

export function mapTask(w: M.Task): Task {
  return {
    id: w.id,
    clubId: w.club_id,
    title: w.title,
    done: w.done,
    dueAt: w.due_on ?? undefined,
    assigneeId: w.assignee_member_id ?? undefined,
    competitionId: w.competition_id ?? undefined,
  };
}

export function mapMarker(w: M.RoutineMarker): RoutineMarker {
  return {
    id: w.id,
    timeMs: w.time_ms ?? 0,
    label: w.label,
    elementCode: w.element_code ?? undefined,
  };
}

export function mapScore(w: M.RoutineScore): RollArtScore {
  return {
    id: w.id,
    date: w.scored_on,
    competitionId: w.competition_id ?? undefined,
    technical: w.technical_score ?? 0,
    components: w.components_score ?? 0,
    total: w.total_score ?? (w.technical_score ?? 0) + (w.components_score ?? 0),
    placement: w.placement ?? null,
  };
}

/** Stabiler numerischer Seed aus einer UUID — für die Platzhalter-Waveform. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function mapRoutine(
  w: M.Routine,
  markers: M.RoutineMarker[],
  scores: M.RoutineScore[],
): Routine {
  return {
    id: w.id,
    clubId: w.club_id,
    title: w.title,
    status: w.status,
    memberIds: w.skater_member_ids,
    teamId: w.team_id ?? undefined,
    music: {
      title: w.music_title ?? "",
      artist: w.music_artist ?? "",
      durationMs: w.music_duration_ms ?? 0,
      bpm: w.music_bpm ?? undefined,
    },
    // Echte Peaks aus dem Audio-Asset; ohne Asset ein deterministischer
    // Anzeige-PLATZHALTER (seeded aus der Routine-ID), klar als solcher markiert.
    waveformPeaks: w.waveform_peaks ?? waveformPeaks(hashSeed(w.id)),
    markers: markers.map(mapMarker).sort((a, b) => a.timeMs - b.timeMs),
    scores: scores.map(mapScore).sort((a, b) => a.date.localeCompare(b.date)),
    category: w.category ?? "",
    audioUrl: w.audio_url ?? null,
    imageUrl: w.image_url ?? null,
  };
}

export function mapNews(w: M.News): News {
  return {
    id: w.id,
    clubId: w.club_id,
    authorMemberId: w.author_member_id,
    title: w.title,
    body: w.body,
    isPinned: w.is_pinned,
    publishedAt: w.published_at ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapNote(w: M.Note): Note {
  return {
    id: w.id,
    ownerProfileId: w.owner_profile_id,
    clubId: w.club_id ?? undefined,
    title: w.title,
    body: w.body,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapExercise(w: M.Exercise): Exercise {
  return {
    id: w.id,
    clubId: w.club_id,
    createdByMemberId: w.created_by_member_id,
    name: w.name,
    description: w.description ?? undefined,
    category: w.category,
    difficulty: w.difficulty ?? undefined,
    videoUrl: w.video_url ?? undefined,
    instructions: w.instructions ?? undefined,
    durationSeconds: w.duration_seconds ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapInvoice(w: M.Invoice): Invoice | null {
  // View-Modell kennt keinen "draft"-Status — Entwürfe sind (noch) keine
  // offenen Posten und werden ausgefiltert statt falsch summiert.
  if (w.status === "draft") return null;
  return {
    id: w.id,
    clubId: w.club_id,
    number: w.number,
    memberId: w.member_id,
    title: w.title,
    amountCents: w.amount_cents ?? 0,
    currency: "EUR",
    issuedAt: w.issued_on ?? w.created_at.slice(0, 10),
    dueAt: w.due_on ?? w.issued_on ?? w.created_at.slice(0, 10),
    status: w.status,
    dunningLevel: Math.min(3, Math.max(0, w.dunning_level)) as DunningLevel,
    paidAt: w.paid_at ?? undefined,
  };
}

/* ---------- App-Shell: eigene Selbstsicht (/me, /me/preferences) ---------- */

function mapMyProfileMembership(w: M.MeMembership): MyProfileMembership {
  return {
    id: w.id,
    clubId: w.club_id,
    clubName: w.club_name,
    clubShortName: w.club_short_name ?? undefined,
    firstName: w.first_name,
    lastName: w.last_name,
    email: w.email ?? undefined,
    birthDate: w.birth_date ?? undefined,
    role: w.role,
    status: mapMemberStatus(w.status),
    joinedOn: w.joined_on ?? undefined,
    validUntil: w.valid_until ?? undefined,
    avatarUrl: mediaUrl(w.avatar_url),
    aboutMe: aboutMeOf(w),
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapMyProfile(w: M.Me): MyProfile {
  return {
    profileId: w.profile_id,
    displayName: w.display_name ?? undefined,
    locale: w.locale,
    memberships: w.memberships.map(mapMyProfileMembership),
  };
}

export function mapUserPreferences(w: M.UserPreferences): UserPreferences {
  return {
    profileId: w.profile_id,
    locale: w.locale,
    theme: w.theme,
    notifications: {
      events: w.notifications.events,
      invoices: w.notifications.invoices,
      news: w.notifications.news,
      chat: w.notifications.chat,
    },
    updatedAt: w.updated_at,
  };
}
