// ============================================================================
// routes/member-profile.ts — DER 360-GRAD-ENDPUNKT.
//
//   GET /clubs/{clubId}/members/{memberId}/profile
//
// Sammelt ALLES fuer EINE Person ein, jede Sektion ROLLEN-GESTAFFELT und
// SERVERSEITIG. Komposition der Trupp-Funktionen (maySeeContactOf,
// redactSelfProfile, selectMemberPhotos) + der READ-Sektionen aus den
// Bestands-Tabellen. JEDE Sektion nur mit den passenden Rechten, sonst NULL.
//
// DIE ZWEI LEITPLANKEN:
//   1. null vs. []: eine Sektion, die der/die Betrachter:in NICHT sehen darf,
//      kommt als null (die Web-Phase blendet sie AUS — kein Fehler, kein "—").
//      Eine erlaubte, aber leere Sektion kommt als [] / leeres Objekt. Die
//      Sichtbarkeitsregel je Sektion ist am memberProfileSchema dokumentiert
//      und spiegelt die ECHTE RLS/API-Regel (aus dem Code gelesen, nicht geraten).
//   2. withUser (RLS traegt) fuer ALLE Sektionen. Der ganze Endpunkt betrifft
//      GENAU EINE Person eines Vereins — kein clubweites Aggregat —, also traegt
//      die RLS pro Tabelle die Zeilen-Sichtbarkeit als zweite Linie. KEIN
//      Service-Mode: die Finanz-Sektion ist auf diese eine (club_id, member_id)
//      begrenzt und die RLS (can_manage_finance / can_act_for_member) liefert
//      genau die richtigen Zeilen — BYPASSRLS waere hier unnoetig und riskant.
//
// N+1: der ganze Profilaufbau laeuft in EINER withUser-Transaktion (EINE
// Pool-Verbindung, db.ts:35). Die Sektions-Abfragen sind konditional — nur wer
// die Sektion sehen darf, fragt sie ueberhaupt ab.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { memberProfileSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { avatarUrlFor } from '../lib/avatar.js';
import { requireClubMemberDb } from '../lib/capabilities.js';
import { ADMIN_ROLES, COACH_ROLES, FINANCE_ROLES, hasClubRole } from '../lib/guards.js';
import {
  maySeeContactOf,
  maySeeFullRoster,
  maySeeInternalSelfProfile,
  maySeeJoinedOn,
  redactMemberForViewer,
  redactSelfProfile,
} from './members.js';
import { selectMemberPhotos } from './photo-tags.js';

export const memberProfileRouter = createRouter();

const memberProfileParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  memberId: uuid.openapi({ param: { name: 'memberId', in: 'path' } }),
});

memberProfileRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/members/{memberId}/profile',
    tags: ['members'],
    summary: 'Das 360-Grad-Profil EINER Person — jede Sektion rollen-gestaffelt und serverseitig',
    description:
      'Sammelt Stammkopf, Selbst-Profil, Kontakt, Kueren, Wettkampf-Noten, Medaillen, Anwesenheit, ' +
      'Check-ins, Pflichtstunden, Termine (RSVP), Ausruestung, Finanzen, Trainer-Beurteilungen, ' +
      'Galerie-Fotos und die Konsent-Uebersicht EINER Person. Jede Sektion wird SERVERSEITIG nach ' +
      'den passenden Rechten gestaffelt: darf der/die Betrachter:in sie nicht sehen, kommt sie als ' +
      'null (nicht als leer/Fehler). Die Regel je Sektion steht im Schema. RLS traegt jede Zeile ' +
      'als zweite Linie; kein Service-Mode (der Endpunkt ist auf EINE Person begrenzt).',
    security: [{ bearerAuth: [] }],
    request: { params: memberProfileParams },
    responses: {
      200: jsonContent(memberProfileSchema, 'Das 360-Grad-Profil (gestaffelte Sektionen)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const claims = c.get('claims');
    // Jede Route hier setzt Vereins-Mitgliedschaft des Betrachters voraus (wie
    // GET /clubs/{id}/members). Danach entscheidet je Sektion die feinere Regel.
    await requireClubMemberDb(c, clubId);

    // Reine Claims-Gates (pro Betrachter, unabhaengig von der Zielzeile).
    const privileged = maySeeFullRoster(claims, clubId); // can_manage_members
    const isAdmin = hasClubRole(claims, clubId, ADMIN_ROLES); // owner/admin/moderator
    const isTrainer = hasClubRole(claims, clubId, COACH_ROLES); // + coach/guest_coach
    const isFinance = hasClubRole(claims, clubId, FINANCE_ROLES); // + treasurer
    const internalSelfViewer = maySeeInternalSelfProfile(claims, clubId);
    const joinedOnVisible = maySeeJoinedOn(claims, clubId);

    const profile = await withUser(claims, async (tx: Tx) => {
      // --------------------------------------------------------------------
      // 1. Stammkopf + Gates in EINER Zeile. Die versteckten Felder laufen
      //    impersoniert (auth.uid() = Betrachter): _self_or_guardian
      //    (can_act_for_member), _coach_of_member (Team-Schnitt, 0054), plus die
      //    DB-Gates can_read_attendance / coaches_member / has_internal_photo_consent.
      // --------------------------------------------------------------------
      const headRows = await tx`
        select m.*,
          coalesce((select jsonb_agg(tm.team_id order by tm.created_at)
                    from app.team_members tm
                    where tm.member_id = m.id and tm.deleted_at is null),
                   '[]'::jsonb) as team_ids,
          app.can_act_for_member(m.id) as _self_or_guardian,
          exists (
            select 1 from app.team_members tm
            where tm.member_id = m.id and tm.deleted_at is null
              and tm.team_id = any (app.coached_team_ids(m.club_id))
          ) as _coach_of_member,
          app.can_read_attendance(m.club_id, m.id)     as _can_read_attendance,
          app.coaches_member(m.club_id, m.id)          as _coaches_member,
          app.has_internal_photo_consent(m.id)         as _photo_consent
        from app.club_members m
        where m.club_id = ${clubId} and m.id = ${memberId} and m.deleted_at is null`;

      const head = headRows[0];
      if (!head) return undefined; // 404 — keine solche Person in diesem Verein

      // Ziel-abhaengige Gates (Paar Betrachter × Zielperson).
      const selfOrGuardian = head['_self_or_guardian'] === true;
      const coachesMember = head['_coaches_member'] === true;
      const canReadAttendance = head['_can_read_attendance'] === true;
      const photoConsent = head['_photo_consent'] === true;
      const contactOfMember = maySeeContactOf(claims, clubId, head); // priv || coach-of-team
      const contactVisible = contactOfMember || selfOrGuardian;
      const selfProfileVisible =
        internalSelfViewer || selfOrGuardian || head['profile_visibility'] === 'public';

      // Kueren / Wettkampf: Spiegel von can_read_routine (read_all=Vorstand,
      // read_team=Team-Trainer, read_own=Skater selbst/Eltern).
      const routineReader = isAdmin || coachesMember || selfOrGuardian;
      // Trainings-/Pflicht-/Ausruestungs-Familie: Trainer ODER Person/Eltern.
      const trainerOrFamily = isTrainer || selfOrGuardian;

      // Stammkopf-Redaktion 1:1 wie der Roster (getestet): Kontaktfelder nach
      // contactVisible, Verwaltungs-Kontakt nach privileged, joined_on nach
      // joinedOnVisible, Selbst-Profil nach redactSelfProfile.
      const withAvatar = {
        ...head,
        avatar_url: avatarUrlFor((head['avatar_key'] as string | null) ?? null),
      };
      const redactedMember = redactSelfProfile(
        redactMemberForViewer(withAvatar, privileged, joinedOnVisible, contactVisible),
        internalSelfViewer,
      );

      // --------------------------------------------------------------------
      // 2. Rollen (RBAC) + Abteilungen — club-lesbar (is_club_member), immer da.
      // --------------------------------------------------------------------
      const roles = await tx`
        select mr.role_id, r.key, r.name_de, r.name_en
        from app.member_roles mr
        join app.roles r on r.id = mr.role_id
        where mr.member_id = ${memberId} and mr.club_id = ${clubId}
        order by r.sort, r.name_de`;
      const departments = await tx`
        select d.id, d.name, (d.lead_member_id = ${memberId}) as is_lead
        from app.department_members dm
        join app.departments d on d.id = dm.department_id and d.deleted_at is null
        where dm.member_id = ${memberId} and dm.club_id = ${clubId} and dm.deleted_at is null
        order by d.sort_order, d.name`;

      // --------------------------------------------------------------------
      // 3. Gestaffelte Sektionen. Jeweils: Gate false -> null; sonst Abfrage
      //    (RLS filtert die Zeilen als zweite Linie) -> Liste (evtl. leer).
      // --------------------------------------------------------------------

      // Kueren (routines + routine_skaters + Musik + Bild). can_read_routine (RLS).
      const routines = routineReader
        ? await tx`
            select r.*,
              coalesce((select jsonb_agg(rs.member_id order by rs.created_at)
                        from app.routine_skaters rs
                        where rs.routine_id = r.id and rs.deleted_at is null),
                       '[]'::jsonb) as skater_member_ids,
              (select ma.waveform_peaks from app.media_assets ma
                 where ma.id = r.audio_asset_id and ma.deleted_at is null) as waveform_peaks
            from app.routines r
            where r.club_id = ${clubId} and r.deleted_at is null
              and exists (select 1 from app.routine_skaters rs
                          where rs.routine_id = r.id and rs.member_id = ${memberId}
                            and rs.deleted_at is null)
            order by r.created_at desc`
        : null;

      // Wettkampf: Starts (competition_entries, club-lesbar) + Notenverlauf
      // (routine_scores, RLS=can_read_routine). Section-Gate wie Kueren.
      const competition = routineReader
        ? {
            entries: await tx`
              select id, member_id, routine_id, status
              from app.competition_entries
              where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
              order by created_at desc`,
            scores: await tx`
              select s.id, s.club_id, s.routine_id, s.competition_id, s.scored_on,
                     s.scoring_system, s.technical_score, s.components_score,
                     s.total_score, s.placement, s.note
              from app.routine_scores s
              where s.club_id = ${clubId} and s.deleted_at is null
                and exists (select 1 from app.routine_skaters rs
                            where rs.routine_id = s.routine_id and rs.member_id = ${memberId}
                              and rs.deleted_at is null)
              order by s.scored_on desc`,
          }
        : null;

      // Medaillen (achievements) — achievements_select = is_club_member -> jedes
      // Vereinsmitglied. Erfolge sind im Verein oeffentlich; immer vorhanden.
      const achievements = await tx`
        select * from app.achievements
        where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
        order by achieved_on desc`;

      // Anwesenheit (attendance) — can_read_attendance (read_all/read_team/read_own).
      const attendance = canReadAttendance
        ? await tx`
            select id, club_id, event_id, member_id, status, checked_in_at
            from app.attendance
            where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
            order by created_at desc`
        : null;

      // Check-in-Historie (checkins) — RLS = is_own_member OR is_club_trainer.
      // Neben der Anwesenheit gestellt; Gate: Trainer ODER Person/Eltern.
      const checkins = trainerOrFamily
        ? await tx`
            select id, club_id, member_id, event_id, method, checked_in_at, created_at
            from app.checkins
            where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
            order by checked_in_at desc`
        : null;

      // Pflichtstunden (Soll/Ist). duty_entries RLS = is_own_member OR is_club_trainer
      // (KEIN treasurer, KEIN Vormund per RLS — CODE GILT). Gate: Trainer ODER
      // Person/Eltern (Auskunft ueber die eigene Verpflichtung, Art. 15).
      const duty = trainerOrFamily
        ? {
            requirements: await tx`
              select id, club_id, team_id, member_id, season_label, required_hours,
                     period_start, period_end, created_at, updated_at
              from app.duty_requirements
              where club_id = ${clubId} and deleted_at is null
                and (
                  member_id = ${memberId}
                  or (member_id is null and (
                       team_id is null
                       or team_id in (select tm.team_id from app.team_members tm
                                      where tm.member_id = ${memberId} and tm.deleted_at is null)
                     ))
                )
              order by period_start desc`,
            entries: await tx`
              select id, club_id, member_id, hours, activity_date, kind, note, approved,
                     created_at, updated_at
              from app.duty_entries
              where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
              order by activity_date desc`,
          }
        : null;

      // Termine (event_rsvps). event_rsvps_select = is_club_member -> jedes
      // Mitglied darf die Zu-/Absagen sehen; der 'sick'-GRUND ist Gesundheitsdatum
      // (0040) und wird von der VIEW app.event_rsvps_visible maskiert, sofern der/die
      // Betrachter:in nicht can_read_rsvp_reason erfuellt (Person/Eltern · owner/admin
      // · Team-Trainer). Deshalb NIE die Rohtabelle lesen. Immer vorhanden.
      const rsvps = await tx`
        select id, club_id, event_id, member_id, status, comment, responded_at
        from app.event_rsvps_visible
        where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
        order by responded_at desc`;

      // Ausruestung (equipment_reservations) — RLS-select = is_club_member; die
      // Schreib-/Eigentums-Regel (0011) ist Trainer ODER eigene Reservierung.
      // Section-Gate: Trainer ODER Person/Eltern. Immer nach member gefiltert.
      const equipment = trainerOrFamily
        ? await tx`
            select id, equipment_id, club_id, reserved_by_member_id, quantity,
                   from_at, to_at, status, created_at, updated_at
            from app.equipment_reservations
            where club_id = ${clubId} and reserved_by_member_id = ${memberId}
              and deleted_at is null
            order by from_at desc`
        : null;

      // Finanzen — NUR Kasse/Vorstand (can_manage_finance) ODER Person/Eltern
      // (die eigene Rechnung/offener Posten, 0002-Privacy). RLS traegt pro Tabelle
      // (invoices: owner/admin/treasurer OR can_act_for_member; member_fees/sepa/
      // donations: can_manage_finance OR can_act_for_member). Kein Service-Mode.
      const finance =
        isFinance || selfOrGuardian
          ? {
              invoices: await tx`
                select * from app.invoices
                where club_id = ${clubId} and member_id = ${memberId}
                order by issued_on desc nulls last, created_at desc`,
              member_fees: await tx`
                select * from app.member_fees
                where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
                order by valid_from desc`,
              sepa_mandates: await tx`
                select * from app.sepa_mandates
                where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
                order by created_at desc`,
              donations: await tx`
                select * from app.donations
                where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
                order by donation_date desc`,
            }
          : null;

      // Trainer-Beurteilung (0055) — member_assessments_select = can_act_for_member
      // OR can_manage_members OR coaches_member. Staff + Familie. RLS traegt.
      const assessments =
        privileged || coachesMember || selfOrGuardian
          ? await tx`
              select id, club_id, member_id, author_member_id, body,
                     rating_technik, rating_ausdruck, assessed_on, created_at, updated_at
              from app.member_assessments
              where club_id = ${clubId} and member_id = ${memberId} and deleted_at is null
              order by assessed_on desc`
          : null;

      // Galerie (Foto-Markierung 0056) — AUSSCHLIESSLICH mit Foto-Einwilligung
      // (has_internal_photo_consent), rollenUNabhaengig: auch Staff sieht ohne
      // Einwilligung nichts. selectMemberPhotos hat die Einwilligung als harten
      // WHERE-Filter. Ohne Einwilligung: Sektion null (nicht gezeigt).
      const photos = photoConsent ? await selectMemberPhotos(tx, clubId, memberId) : null;

      // Konsent-Uebersicht (effective_consents) — consents_select = eigene/
      // selbst-erklaerte OR can_manage_members. Staff + Person/Eltern.
      const consents =
        privileged || selfOrGuardian
          ? await tx`
              select id, club_id, member_id, subject_profile_id, purpose,
                     granted_by_profile_id, legal_document_id, policy_version,
                     recorded_at, effective, recorded_granted, granted_by_guardian, state
              from app.effective_consents
              where club_id = ${clubId} and member_id = ${memberId}
              order by recorded_at desc`
          : null;

      return {
        member: redactedMember,
        contact_visible: contactVisible,
        admin_contact_visible: privileged,
        self_profile_visible: selfProfileVisible,
        joined_on_visible: joinedOnVisible,
        roles,
        departments,
        routines,
        competition,
        achievements,
        attendance,
        checkins,
        duty,
        rsvps,
        equipment,
        finance,
        assessments,
        photos,
        consents,
      };
    });

    if (!profile) {
      throw problem(404, 'Not Found', 'Keine solche Person in diesem Verein. / No such member in this club.');
    }
    return c.json(memberProfileSchema.parse(profile), 200);
  },
);
