import type { Member, Routine } from "@/lib/types";
import { ApiError } from "@/lib/api/generated";
import type * as M from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
import { readOperatorClub } from "../operator-club";
import type { DataRepository, DunningRunOutcome } from "../types";
import { activeClubId, apiClient } from "./client";
import { attachRoutineMedia, deleteClubLogo, detachRoutineMedia, uploadClubLogo } from "./media-fetch";
import { moduleApiRepository } from "./modules";
import { moduleApiRepositoryBatch2 } from "./modules-batch2";
import { moduleApiRepositoryBatch3 } from "./modules-batch3";
import { moduleApiRepositoryBatch4 } from "./modules-batch4";
import { moduleApiRepositoryBatch5 } from "./modules-batch5";
import { moduleApiRepositoryCluster6a } from "./modules-cluster6a";
import { moduleApiRepositoryFinance } from "./modules-finance";
import { moduleApiRepositoryFinanceB } from "./modules-financeb";
import { moduleApiRepositoryFinanceC } from "./modules-financec";
import { moduleApiRepositoryMe } from "./modules-me";
import { moduleApiRepositoryClubModules } from "./modules-clubmodules";
import { moduleApiRepositoryRbac } from "./modules-rbac";
import { moduleApiRepositoryRegistrierung } from "./modules-registrierung";
import { moduleApiRepositorySupport } from "./modules-support";
import { moduleApiRepositoryOrg } from "./modules-org";
import { moduleApiRepositorySparten } from "./modules-sparten";
import { moduleApiRepositoryFahrgemeinschaften } from "./modules-fahrgemeinschaften";
import { moduleApiRepositoryPlatform } from "./modules-platform";
import { moduleApiRepositoryWettkampf } from "./modules-wettkampf";
import {
  mapAttendance,
  mapClub,
  mapClubSmtp,
  mapCompetition,
  mapEvent,
  mapGuardianship,
  mapInvoice,
  mapLedgerEntry,
  mapMarker,
  mapMember,
  mapPlatformClub,
  mapPlatformStats,
  mapPlatformUser,
  mapRoutine,
  mapTask,
  mapTeam,
} from "./mappers";

/**
 * API-Implementierung der Repository-Facade — nutzt den GENERIERTEN Client
 * gegen den lokalen Dev-Stack (scripts/dev-stack.sh up, Port 3022).
 *
 * ECHTE Daten mit ECHTER RLS: der Coach sieht kein Kassenbuch, ein Member
 * nur die eigenen Rechnungen. Fehler kommen als ApiError (RFC 7807).
 *
 * Seit Contract v0.2.0 ist die Facade vollständig angebunden (Teams,
 * Familien, RSVPs, Anwesenheit, Kassenbuch, Wettkämpfe, Aufgaben) —
 * es gibt keine NotImplemented-Pfade mehr.
 */

/** Küre inkl. Marker + Scores laden (zwei Unter-Endpoints, parallel). */
function loadRoutineDetails(routineId: string) {
  return Promise.all([
    apiClient.getRoutinesByRoutineIdMarkers(routineId),
    apiClient.getRoutinesByRoutineIdScores(routineId),
  ]);
}

/**
 * BETREIBER-EINSICHT: die „aktuelle Person“, wenn ein Plattform-Admin einen
 * Verein ansieht.
 *
 * ### Warum es das braucht — beim Durchklicken gefunden, nicht vermutet ###
 * Der Betreiber hat in KEINEM Verein eine Mitgliedszeile (die Plattform-Persona
 * trägt member_id/club_id/club_role = null). getCurrentUser() lief deshalb ins
 * 401 „Nicht angemeldet (Dev-Login fehlt)“ — und zwar NACHDEM der Roster
 * erfolgreich geladen war. Ergebnis: der Umschalter brachte ihn in den Verein,
 * der Server lieferte die Daten, und die Seite zeigte trotzdem einen
 * Anmeldefehler. Der Zugriff war repariert, die Oberfläche nicht.
 *
 * ### Warum 'owner' ###
 * Kein geschönter Wert, sondern derselbe Begriff wie überall sonst:
 * guards.ts:OPERATOR_CLUB_ROLE tritt bei eingeschalteter Einsicht als 'owner'
 * auf, und app.cap_rank gibt ihm Rang 5 (nur owner bekommt den). Ein anderer
 * Wert hier hieße: die Oberfläche blendet Knöpfe aus, die der Server erlaubt —
 * oder zeigt welche, die er verweigert. Genau EIN Begriff von
 * Betreiber-Autorität, in DB, API und Client.
 *
 * Das ist KEINE Rechte-Vergabe: `permissions()` steuert nur Sichtbarkeit, und
 * readOperatorClub() ist fail-closed (ohne Plattform-Claim null). Wer diesen
 * Zustand ohne Claim herstellt, sieht Knöpfe — und bekommt vom Server 403.
 */
function operatorMember(): Member | null {
  const viewing = readOperatorClub();
  if (viewing === null) return null;
  const session = readSession();
  if (!session) return null;
  const parts = session.profile.display_name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? (parts.pop() as string) : "";
  return {
    // Es gibt keine Mitglieds-Id — der Betreiber IST kein Mitglied. Die
    // Profil-Id ist der ehrlichste Wert: sie identifiziert ihn und stimmt mit
    // dem überein, was im Protokoll als actor_profile_id steht.
    id: session.profile.sub,
    clubId: viewing.id,
    firstName: parts.join(" ") || session.profile.display_name,
    lastName,
    role: "owner",
    status: "active",
    email: session.profile.email,
    teamIds: [],
    joinedAt: "",
  };
}

/** Fallback: eingeloggte Person aus dem Dev-Login-Profil synthetisieren. */
function memberFromProfile(): Member | null {
  const session = readSession();
  if (!session) return null;
  const { profile } = session;
  // Betreiber-Einsicht: keine Mitgliedszeile, aber sehr wohl eine Person.
  const operator = operatorMember();
  if (operator !== null) return operator;
  // Plattform-Persona OHNE gewählten Verein: keine club_members-Zeile, keine
  // Club-Rolle → kein Member. Sie gehört auf die Konsole, nicht ins Portal.
  if (!profile.member_id || !profile.club_id || !profile.club_role) return null;
  const parts = profile.display_name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? (parts.pop() as string) : "";
  return {
    id: profile.member_id,
    clubId: profile.club_id,
    firstName: parts.join(" ") || profile.display_name,
    lastName,
    role: profile.club_role,
    status: "active",
    email: profile.email,
    teamIds: [],
    joinedAt: "",
  };
}

export const apiRepository: DataRepository = {
  /* ---------- Verein & Menschen ---------- */
  async getClub() {
    return mapClub(await apiClient.getClubsByClubId(activeClubId()));
  },
  async uploadClubLogo(file) {
    return mapClub(await uploadClubLogo(activeClubId(), file));
  },
  async removeClubLogo() {
    return mapClub(await deleteClubLogo(activeClubId()));
  },
  async getMembers() {
    const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
    return roster.map(mapMember);
  },
  async getMemberById(id) {
    const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
    const hit = roster.find((m) => m.id === id);
    return hit ? mapMember(hit) : undefined;
  },
  async getMemberProfile(memberId) {
    // Der Aggregat-Endpunkt trägt die Sichtbarkeit selbst (RLS + gestaffelte
    // Sektionen). Wir reichen die Vertrags-Antwort UNVERÄNDERT durch — null vs.
    // [] bleibt erhalten, damit die Detailseite verbotene Sektionen ausblendet.
    return apiClient.getClubsByClubIdMembersByMemberIdProfile(activeClubId(), memberId);
  },
  async createMemberAssessment(input) {
    return apiClient.postAssessments({
      club_id: activeClubId(),
      member_id: input.memberId,
      body: input.body,
      ...(input.ratingTechnik != null ? { rating_technik: input.ratingTechnik } : {}),
      ...(input.ratingAusdruck != null ? { rating_ausdruck: input.ratingAusdruck } : {}),
      ...(input.assessedOn ? { assessed_on: input.assessedOn } : {}),
    });
  },
  async listMemberCoachNotes(memberId) {
    // Eigener Endpunkt, NICHT das Profil-Aggregat — siehe die Begründung in
    // inputs-memberprofile.ts. Unberechtigte bekommen 200 + [].
    return apiClient.getCoachNotes({ club_id: activeClubId(), member_id: memberId });
  },
  async createMemberCoachNote(input) {
    return apiClient.postCoachNotes({
      club_id: activeClubId(),
      member_id: input.memberId,
      body: input.body,
    });
  },
  async updateMemberCoachNote(noteId, input) {
    // member_id/author_member_id/club_id sind nicht Teil des Update-Schemas —
    // eine Notiz wandert nicht zu einer anderen Person.
    return apiClient.patchCoachNotesByNoteId(noteId, { body: input.body });
  },
  async deleteMemberCoachNote(noteId) {
    const deleted = await apiClient.deleteCoachNotesByNoteId(noteId);
    return { id: deleted.id };
  },
  async getTeams() {
    const teams = await apiClient.getClubsByClubIdTeams(activeClubId());
    return teams.map(mapTeam);
  },
  async getGuardianships() {
    const rows = await apiClient.getClubsByClubIdGuardianships(activeClubId());
    return rows.map(mapGuardianship);
  },
  async getCurrentUser() {
    const session = readSession();
    if (!session) throw new ApiError(401, null, "Nicht angemeldet (Dev-Login fehlt)");
    try {
      const roster = await apiClient.getClubsByClubIdMembers(activeClubId());
      const own = roster.find((m) => m.id === session.profile.member_id);
      if (own) return mapMember(own);
    } catch {
      // RLS kann den Roster einschränken — Profil-Fallback unten.
    }
    const fallback = memberFromProfile();
    if (!fallback) throw new ApiError(401, null, "Nicht angemeldet (Dev-Login fehlt)");
    return fallback;
  },

  /* ---------- Termine, RSVP & Anwesenheit ---------- */
  async getEvents() {
    const events = await apiClient.getEvents({ club_id: activeClubId() });
    return events.map(mapEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async getUpcomingEvents(withinDays = 7) {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 86_400_000);
    const events = await apiClient.getEvents({
      club_id: activeClubId(),
      from: now.toISOString(),
      to: horizon.toISOString(),
    });
    return events.map(mapEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async getAttendance() {
    const rows = await apiClient.getAttendance({ club_id: activeClubId() });
    return rows.map(mapAttendance);
  },

  /* ---------- Küren ---------- */
  async getRoutines() {
    const routines = await apiClient.getRoutines({ club_id: activeClubId() });
    return Promise.all(
      routines.map(async (w): Promise<Routine> => {
        const [markers, scores] = await loadRoutineDetails(w.id);
        return mapRoutine(w, markers, scores);
      }),
    );
  },
  async getRoutineById(id) {
    try {
      const w = await apiClient.getRoutinesByRoutineId(id);
      const [markers, scores] = await loadRoutineDetails(w.id);
      return mapRoutine(w, markers, scores);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  },
  async attachRoutineAudio(routineId, file) {
    // EIN Schritt: multipart DIREKT an /routines/{id}/audio (Server erzeugt den
    // storage_key). mediaError macht aus 402 einen ClubProRequiredError.
    const updated = await attachRoutineMedia(routineId, "audio", file, "Kür-Musik");
    const [markers, scores] = await loadRoutineDetails(routineId);
    return mapRoutine(updated, markers, scores);
  },
  async attachRoutineImage(routineId, file) {
    const updated = await attachRoutineMedia(routineId, "image", file, "Kür-Bild");
    const [markers, scores] = await loadRoutineDetails(routineId);
    return mapRoutine(updated, markers, scores);
  },
  async detachRoutineAudio(routineId) {
    const updated = await detachRoutineMedia(routineId, "audio", "Kür-Musik");
    const [markers, scores] = await loadRoutineDetails(routineId);
    return mapRoutine(updated, markers, scores);
  },
  async detachRoutineImage(routineId) {
    const updated = await detachRoutineMedia(routineId, "image", "Kür-Bild");
    const [markers, scores] = await loadRoutineDetails(routineId);
    return mapRoutine(updated, markers, scores);
  },

  /* ---------- Finanzen ---------- */
  async getInvoices() {
    const invoices = await apiClient.getInvoices({ club_id: activeClubId() });
    return invoices
      .map(mapInvoice)
      .filter((i): i is NonNullable<typeof i> => i !== null);
  },
  async getLedger() {
    const rows = await apiClient.getLedger({ club_id: activeClubId() });
    return rows.map(mapLedgerEntry);
  },

  /* ---------- Wettkampf & Aufgaben ---------- */
  async getCompetitions() {
    const rows = await apiClient.getCompetitions({ club_id: activeClubId() });
    return rows.map(mapCompetition);
  },
  async getTasks() {
    const rows = await apiClient.getTasks({ club_id: activeClubId() });
    return rows.map(mapTask);
  },

  /* ---------- Schreibpfade ---------- */
  async setRsvp({ eventId, memberId, status, comment }) {
    await apiClient.putEventsByEventIdRsvp(eventId, {
      member_id: memberId,
      status,
      comment,
    });
    return true;
  },
  async setAttendance({ eventId, memberId, status, checkedInAt }) {
    await apiClient.putEventsByEventIdAttendance(eventId, {
      member_id: memberId,
      status,
      checked_in_at: checkedInAt,
    });
    return true;
  },
  async changeMemberRole(memberId, role) {
    await apiClient.patchClubsByClubIdMembersByMemberIdRole(activeClubId(), memberId, {
      role,
    });
    return true;
  },
  async runDunning(options): Promise<DunningRunOutcome> {
    const result = await apiClient.postClubsByClubIdDunningRun(activeClubId(), {
      dry_run: options?.dryRun ?? true,
    });
    return {
      dryRun: result.dry_run,
      total: result.actions.length,
      auto: result.summary.auto,
      pendingApproval: result.summary.pending_approval,
      none: result.summary.none,
    };
  },
  async setTaskDone(taskId, done) {
    await apiClient.patchTasksByTaskId(taskId, { done });
    return true;
  },
  async createEvent(input) {
    const created = await apiClient.postEvents({
      club_id: activeClubId(),
      type: input.type,
      title: input.title,
      location: input.location,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      audience: input.audience ?? "teams",
      team_ids: input.teamIds,
      note: input.note,
    });
    return mapEvent(created);
  },
  async updateEvent(id, patch) {
    const updated = await apiClient.patchEventsByEventId(id, {
      type: patch.type,
      title: patch.title,
      location: patch.location,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      audience: patch.audience,
      team_ids: patch.teamIds,
      note: patch.note,
    });
    return mapEvent(updated);
  },
  async deleteEvent(id) {
    const deleted = await apiClient.deleteEventsByEventId(id);
    return { id: deleted.id };
  },
  async inviteMember(input) {
    const queued = await apiClient.postClubsByClubIdMembersInvite(activeClubId(), {
      email: input.email,
      role: input.role,
    });
    return { email: queued.email };
  },
  async addRoutineMarker(routineId, input) {
    const created = await apiClient.postRoutinesByRoutineIdMarkers(routineId, {
      time_ms: input.timeMs,
      label: input.label,
      element_code: input.elementCode,
    });
    return mapMarker(created);
  },

  /* ---------- Verwaltung: Mitglieder-Stammdaten ---------- */
  async createMember(input) {
    const created = await apiClient.postClubsByClubIdMembers(activeClubId(), {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      birth_date: input.birthDate,
      role: input.role,
      joined_on: input.joinedOn,
      valid_until: input.validUntil,
    });
    return mapMember(created);
  },
  async updateMember(memberId, patch) {
    const updated = await apiClient.patchClubsByClubIdMembersByMemberId(
      activeClubId(),
      memberId,
      {
        first_name: patch.firstName,
        last_name: patch.lastName,
        email: patch.email,
        birth_date: patch.birthDate,
        phone: patch.phone,
        postal_address: patch.postalAddress,
        status: patch.status,
        valid_until: patch.validUntil,
      },
    );
    return mapMember(updated);
  },
  async deleteMember(memberId) {
    const deleted = await apiClient.deleteClubsByClubIdMembersByMemberId(
      activeClubId(),
      memberId,
    );
    return { id: deleted.id };
  },

  /* ---------- Verwaltung: Teams ---------- */
  async createTeam(input) {
    const created = await apiClient.postClubsByClubIdTeams(activeClubId(), {
      name: input.name,
      age_group: input.ageGroup,
    });
    return mapTeam(created);
  },
  async updateTeam(teamId, patch) {
    const updated = await apiClient.patchClubsByClubIdTeamsByTeamId(activeClubId(), teamId, {
      name: patch.name,
      age_group: patch.ageGroup,
    });
    return mapTeam(updated);
  },
  async deleteTeam(teamId) {
    const deleted = await apiClient.deleteClubsByClubIdTeamsByTeamId(activeClubId(), teamId);
    return { id: deleted.id };
  },
  async setTeamMembers(teamId, input) {
    const updated = await apiClient.putClubsByClubIdTeamsByTeamIdMembers(
      activeClubId(),
      teamId,
      {
        coach_member_ids: input.coachIds,
        skater_member_ids: input.skaterIds,
      },
    );
    return mapTeam(updated);
  },

  /* ---------- Verwaltung: Vereins-Einstellungen ---------- */
  async updateClubSettings(patch) {
    const updated = await apiClient.patchClubsByClubId(activeClubId(), {
      name: patch.name,
      short_name: patch.shortName,
      city: patch.city,
      discipline: patch.discipline,
      founded_year: patch.foundedYear,
      contact_email: patch.contactEmail,
      contact_phone: patch.contactPhone,
      street: patch.street,
      postal_code: patch.postalCode,
      country: patch.country,
      website_url: patch.websiteUrl,
      description: patch.description,
      public_profile_enabled: patch.publicProfileEnabled,
      public_description: patch.publicDescription,
      public_image: patch.publicImage,
      settings: patch.settings,
      // Marken-/Akzentfarbe (0084). EXPLIZIT mitsenden — auch als null: der
      // Nutzer, der auf den Standard zurueckstellt, schickt brandColor/-Preset
      // = null, und die Spalte MUSS geleert werden (waere sie undefined,
      // liesse der Server sie stehen). Nur ganz weglassen, wenn der Aufrufer
      // das Feld gar nicht angefasst hat (undefined). brand_preset ist der
      // 7er-Enum des Wire; VereinForm setzt nur gueltige Schluessel oder null.
      ...(patch.brandColor !== undefined ? { brand_color: patch.brandColor } : {}),
      ...(patch.brandPreset !== undefined
        ? { brand_preset: patch.brandPreset as M.ClubUpdate["brand_preset"] }
        : {}),
    });
    return mapClub(updated);
  },
  async getClubSmtp() {
    return mapClubSmtp(await apiClient.getClubsByClubIdSmtp(activeClubId()));
  },
  async updateClubSmtp(patch) {
    const updated = await apiClient.patchClubsByClubIdSmtp(activeClubId(), {
      smtp_host: patch.host,
      smtp_port: patch.port,
      smtp_user: patch.user,
      smtp_from: patch.from,
      smtp_secure: patch.secure,
      // WRITE-ONLY: nur mitsenden, wenn wirklich eines gesetzt wurde.
      smtp_password: patch.password,
    });
    return mapClubSmtp(updated);
  },

  /* ---------- Module: Neuigkeiten, Notizen, Übungen (Batch 1) ---------- */
  ...moduleApiRepository,

  /* ---------- Module: Hallen, Buchungen, Equipment, Reservierungen, Erfolge (Batch 2) ---------- */
  ...moduleApiRepositoryBatch2,

  /* ---------- Module: Trainingsplan, Pflichtstunden, Auswertung (Batch 3) ---------- */
  ...moduleApiRepositoryBatch3,

  /* ---------- Module: Chat, Check-in, überregionale Events (Batch 4) ---------- */
  ...moduleApiRepositoryBatch4,

  /* ---------- Module: Galerie, Dokumente, Entitlement (Batch 5) ---------- */
  ...moduleApiRepositoryBatch5,

  /* ---------- Module: Wartelisten, Budget, Familie-Selfservice, Profilfoto (Cluster 6a) ---------- */
  ...moduleApiRepositoryCluster6a,

  /* ---------- Module: Kassenbuch-Kategorien, Rechnungs-Detail, Mahnwesen (Finanz A) ---------- */
  ...moduleApiRepositoryFinance,

  /* ---------- Module: Beitragskategorien, -zuordnungen, Familienrabatte, SEPA (Finanz B) ---------- */
  ...moduleApiRepositoryFinanceB,

  /* ---------- Module: Bankabgleich, Spenden, Jahresabschluss, Export (Finanz C) ---------- */
  ...moduleApiRepositoryFinanceC,

  /* ---------- Module: App-Shell-Selbstsicht (eigenes Profil + Präferenzen) ---------- */
  ...moduleApiRepositoryMe,
  ...moduleApiRepositoryClubModules,
  ...moduleApiRepositoryRbac,
  ...moduleApiRepositoryRegistrierung,
  ...moduleApiRepositorySupport,

  /* ---------- Module: Abteilungen, Schließfächer, Jubiläen (Organisation) ---------- */
  ...moduleApiRepositoryOrg,

  /* ---------- Module: Sparten (fachliche Großbereiche, n:m Mitglieder) ---------- */
  ...moduleApiRepositorySparten,

  /* ---------- Module: Fahrgemeinschaften zu Terminen (0066) ---------- */
  ...moduleApiRepositoryFahrgemeinschaften,

  /* ---------- Module: Rangliste, Live-Wertung, Verbandsmeldung, Kür-Teilen (Wettkampf) ---------- */
  ...moduleApiRepositoryWettkampf,

  /* ---------- Plattform-Konsole (reine Lesesicht) ---------- */
  async platformListClubs() {
    const rows = await apiClient.getPlatformClubs();
    return rows.map(mapPlatformClub);
  },
  async platformListUsers() {
    const rows = await apiClient.getPlatformUsers();
    return rows.map(mapPlatformUser);
  },
  async platformStats() {
    return mapPlatformStats(await apiClient.getPlatformStats());
  },

  /* ---------- Plattform-Konsole: Lizenzen, Zahlungen, Produkte, System, Einstellungen ---------- */
  ...moduleApiRepositoryPlatform,
};
