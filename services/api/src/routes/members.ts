// ============================================================================
// routes/members.ts - roster of a club: list, create, invite (stub), and the
// role-change endpoint that closes the v1 gap:
//   * only owner/admin may change roles,
//   * nobody changes their OWN role,
//   * owner rows only by owners,
//   * the LAST owner can never be demoted (API-level rule).
// The UPDATE itself runs impersonated, so the protect_club_membership trigger
// fires as second line of defense.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  guardianshipSchema,
  inviteSchema,
  memberCreateSchema,
  memberSchema,
  memberSelfProfileUpdateSchema,
  memberUpdateSchema,
  roleChangeSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { avatarUrlFor } from '../lib/avatar.js';
import {
  ADMIN_ROLES,
  MANAGE_MEMBER_ROLES,
  canAssignRole,
  checkRoleChange,
  hasClubRole,
  isPlatformAdmin,
  requireClubRole,
} from '../lib/guards.js';
import { requireClubMemberDb } from '../lib/capabilities.js';
import type { AuthClaims, ClubRole } from '../middleware/auth.js';

export const membersRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const memberParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  memberId: uuid.openapi({ param: { name: 'memberId', in: 'path' } }),
});

/** Add the derived avatar_url (from avatar_key) to a club_members row. */
function withAvatar<T extends Record<string, unknown>>(row: T): T & { avatar_url: string | null } {
  return { ...row, avatar_url: avatarUrlFor((row['avatar_key'] as string | null) ?? null) };
}

/**
 * KONTAKT-/PII-Spalten. Sichtbar nur fuer can_manage_members oder Plattform-
 * Admins. Nicht-privilegierte Betrachter (member / coach / guest_coach) sehen
 * die unkritischen Felder: id/first_name/last_name/team_ids/role/status — plus
 * seit 0045 das Selbst-Profil, das die Person freiwillig veroeffentlicht hat.
 *
 * ### 0045: joined_on ist HIER RAUS und hat ein eigenes Gate ###
 * Der Nutzer will, dass "trainer und hoeher" das Beitrittsdatum sehen. Der
 * bequeme Weg waere gewesen, dem coach maySeeFullRoster zu geben — dann hoerte
 * er aber auch E-MAIL und GEBURTSDATUM der Kinder mit, und der Seed sagt fuer
 * member_contact/coach ausdruecklich 'none' (0023:180). Das waere eine stille
 * Ausweitung, die niemand bestellt hat: bestellt war ein Datum, geliefert
 * waeren die Kontaktdaten von 17 Kindern.
 * Deshalb zwei Gates statt einem. Ein Gate, das fuenf Spalten auf einmal
 * freigibt, kann eine Anforderung wie "nur diese eine" gar nicht ausdruecken.
 */
const CONTACT_MEMBER_FIELDS = ['birth_date', 'email', 'valid_until', 'profile_id'] as const;

/** Eigenes Gate, eigene Liste — siehe oben. */
const JOINED_ON_FIELDS = ['joined_on'] as const;

/**
 * Rollen, die das Beitrittsdatum sehen duerfen = "Trainer und hoeher".
 *
 * MANAGE_MEMBER_ROLES (owner/admin/moderator/treasurer) + coach.
 * BEWUSST OHNE guest_coach: ein Gast-Trainer ist eine vereinsEXTERNE Person auf
 * Zeit (valid_until ist fuer ihn Pflicht, 0002:84-85). "Trainer und hoeher"
 * meint die Trainerin des Vereins, nicht die Aushilfe vom Nachbarverein — und
 * fuer den Gast ist "seit wann ist dieses Kind im Verein" ohne Aufgabe.
 * Genau dieselbe Person war der belegte Leck-Fall bei /reports/anniversaries.
 */
const JOINED_ON_ROLES: readonly ClubRole[] = [...MANAGE_MEMBER_ROLES, 'coach'];

/**
 * True when the viewer may see the CONTACT columns (birth_date/email/…).
 *
 * KEIN eigener isPlatformAdmin-Zweig: hasClubRole laesst den Betreiber bereits
 * durch — ABER nur ueber hasOperatorOverride, also erst nachdem die
 * Audit-Middleware den Zugriff protokolliert und app.operator_override gesetzt
 * hat. Ein blosser isPlatformAdmin(claims) waere die zweite, protokoll-FREIE
 * Tuer, die 0051 abschaffen wollte (der Roster traegt birth_date/email von
 * Kindern). Genau die haben wir hier entfernt.
 */
export function maySeeFullRoster(claims: AuthClaims, clubId: string): boolean {
  return hasClubRole(claims, clubId, MANAGE_MEMBER_ROLES);
}

/**
 * True when the viewer may see joined_on ("Trainer und hoeher").
 *
 * DIE REFERENZ FUER /reports/anniversaries: Jubilaeums-Zeilen erscheinen genau
 * dann, wenn derselben Person der Roster joined_on zeigt (aus `date` minus
 * `years` laesst sich joined_on exakt rekonstruieren). reports.ts ruft deshalb
 * DIESE Funktion — nicht eine zweite, gleichbedeutend gemeinte Bedingung.
 * Vorher stand dort `member_contact >= read_all`, was laut Kommentar "im Seed
 * deckungsgleich" mit maySeeFullRoster war: zwei Mechanismen (DB-aufgeloeste
 * Faehigkeit vs. Rollen-Claim), die nur solange gleich antworten, wie niemand
 * member_contact im Admin-UI anfasst. Eine gemeinsame Funktion kann nicht
 * auseinanderlaufen.
 */
export function maySeeJoinedOn(claims: AuthClaims, clubId: string): boolean {
  // Betreiber laeuft ueber hasClubRole -> hasOperatorOverride (ans Protokoll
  // gekoppelt); kein protokoll-freier isPlatformAdmin-Zweig, siehe maySeeFullRoster.
  return hasClubRole(claims, clubId, JOINED_ON_ROLES);
}

/**
 * Null out the sensitive columns of a roster row for a non-privileged viewer.
 * The keys stay present (memberSchema requires them, nullable) so the response
 * shape is unchanged — no contract break, just redacted values.
 *
 * `joinedOnVisible` defaults to `privileged`: der alte Zwei-Argument-Aufruf
 * verhaelt sich damit exakt wie vorher (joined_on faellt mit den Kontaktdaten).
 * Nur wer das dritte Argument setzt, bekommt die feinere Trennung.
 */
export function redactMemberForViewer<T extends Record<string, unknown>>(
  row: T,
  privileged: boolean,
  joinedOnVisible: boolean = privileged,
): T {
  if (privileged && joinedOnVisible) return row;
  const out: Record<string, unknown> = { ...row };
  if (!privileged) for (const field of CONTACT_MEMBER_FIELDS) out[field] = null;
  if (!joinedOnVisible) for (const field of JOINED_ON_FIELDS) out[field] = null;
  return out as T;
}

// ============================================================================
// SELBST-PROFIL-PROJEKTION (0053) — das Gegenstueck zur Kontaktdaten-Redaktion.
//
// Die Selbst-Profil-Felder (Motto/Disziplin/seit-wann) und die Stufe selbst
// werden fuer eine:n Betrachter:in NUR ausgeliefert, wenn EINE der drei
// Bedingungen gilt:
//   (a) profile_visibility = 'public' und Betrachter ist Vereinsmitglied
//       (jede Route hier ist ohnehin schon requireClubMemberDb-gated), ODER
//   (b) Betrachter ist Vorstand/Trainer — die "intern"-Stufe, ODER
//   (c) Betrachter ist die Person selbst oder ihr/e Erziehungsberechtigte/r.
// Sonst kommen die vier Felder als NULL zurueck (wie birth_date fuer
// Nicht-Berechtigte). profile_visibility SELBST sieht nur, wer auch die Felder
// sieht — sonst nicht (die Stufe ist selbst eine Aussage ueber das Profil).
//
// DIESELBE WAHRHEIT WIE DIE ROSTER-REDAKTION: das passiert hier in der API,
// nicht in RLS. Begruendung im Kopf von 0053 — kurz: die Kontaktdaten-Redaktion
// sitzt schon in der API; ein zweiter Ort (RLS-Spaltenlogik) fuer "wer darf das
// sehen" liefe frueher oder spaeter auseinander.
//
// (a) ist ein Spalten-Wert, (b) ein Rollen-Claim (maySeeInternalSelfProfile),
// (c) eine DB-Frage (app.can_act_for_member) — die Abfragen liefern sie als
// verstecktes Feld _self_or_guardian mit. redactSelfProfile bekommt (b) als
// Argument und liest (a)/(c) aus der Zeile.
// ============================================================================
export const SELF_PROFILE_FIELDS = [
  'profile_motto',
  'profile_favorite_discipline',
  'profile_skating_since',
  'profile_visibility',
] as const;

/**
 * Verstecktes Abfrage-Feld: `app.can_act_for_member(m.id)` als boolean. Wird von
 * den Roster-/DM-Abfragen mitselektiert und von redactSelfProfile gelesen +
 * entfernt, damit es nicht im Contract landet (memberSchema.parse wuerde es
 * ohnehin verwerfen — wir raeumen es trotzdem selbst weg).
 */
const SELF_OR_GUARDIAN_KEY = '_self_or_guardian';

/**
 * Rollen, die die INTERNEN Selbst-Profile sehen ("Vorstand/Trainer").
 * BEWUSST OHNE treasurer: der Kassenwart ist kein Trainer und keine Leitung —
 * die "intern"-Stufe ist eine Freigabe an die Personen, die mit dem Kind
 * trainieren/den Verein fuehren, nicht an die Finanzverwaltung. Dieselbe
 * Trennung wie bei der Anwesenheit (0045): treasurer ist ein Nachbar in der
 * Rangordnung, kein "Trainer und hoeher". guest_coach IST hier drin (anders als
 * bei joined_on): der Gast-Trainer trainiert die Kinder und ist damit Teil des
 * gewollten "intern"-Publikums.
 */
const SELF_PROFILE_INTERNAL_ROLES: readonly ClubRole[] = [
  'owner',
  'admin',
  'moderator',
  'coach',
  'guest_coach',
];

/**
 * True when the viewer belongs to the "Vorstand/Trainer" audience that sees
 * INTERNAL self profiles (Stufe (b)). Pure claims check, mirrors
 * maySeeFullRoster/maySeeJoinedOn.
 */
export function maySeeInternalSelfProfile(claims: AuthClaims, clubId: string): boolean {
  return hasClubRole(claims, clubId, SELF_PROFILE_INTERNAL_ROLES);
}

/**
 * Redigiert die Selbst-Profil-Felder einer Roster-Zeile fuer eine:n Betrachter:in.
 * `internalViewer` = Stufe (b) (aus maySeeInternalSelfProfile). Die Zeile MUSS
 * `profile_visibility` (Stufe (a)) und `_self_or_guardian` (Stufe (c), aus
 * app.can_act_for_member) tragen — Letzteres wird immer entfernt.
 */
export function redactSelfProfile<T extends Record<string, unknown>>(
  row: T,
  internalViewer: boolean,
): T {
  const out: Record<string, unknown> = { ...row };
  const selfOrGuardian = out[SELF_OR_GUARDIAN_KEY] === true;
  delete out[SELF_OR_GUARDIAN_KEY];
  const visible = internalViewer || selfOrGuardian || out['profile_visibility'] === 'public';
  if (!visible) for (const field of SELF_PROFILE_FIELDS) out[field] = null;
  return out as T;
}

/** team_ids of one member (app.team_members, soft-deleted excluded). */
async function teamIdsOf(tx: Tx, memberId: string): Promise<unknown> {
  const rows = await tx`
    select coalesce(jsonb_agg(tm.team_id order by tm.created_at), '[]'::jsonb) as ids
    from app.team_members tm
    where tm.member_id = ${memberId} and tm.deleted_at is null`;
  return rows[0]?.['ids'] ?? [];
}

membersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/members',
    tags: ['members'],
    summary: 'List the club roster (sensitive columns redacted for non-managers)',
    description:
      'Jedes Vereinsmitglied sieht die Namensliste, das Foto (avatar_url) und das ' +
      'Selbst-Profil (profile_motto, profile_favorite_discipline, profile_skating_since) — ' +
      'letzteres pflegt die Person selbst und veroeffentlicht es damit bewusst im Verein. ' +
      'ZWEI Redigier-Stufen: die KONTAKTdaten (birth_date, email, valid_until, profile_id) ' +
      'sehen nur can_manage_members (treasurer/moderator/admin/owner) + Plattform-Admins; ' +
      'joined_on sieht zusaetzlich der coach ("Trainer und hoeher", ohne guest_coach). ' +
      'Redigierte Spalten bleiben als null im Ergebnis.',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(memberSchema), 'Active membership rows'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const claims = c.get('claims');
    await requireClubMemberDb(c, clubId);
    const privileged = maySeeFullRoster(claims, clubId);
    const joinedOnVisible = maySeeJoinedOn(claims, clubId);
    const internalProfileViewer = maySeeInternalSelfProfile(claims, clubId);
    const rows = await withUser(claims, (tx) =>
      tx`select m.*,
           coalesce((select jsonb_agg(tm.team_id order by tm.created_at)
                     from app.team_members tm
                     where tm.member_id = m.id and tm.deleted_at is null),
                    '[]'::jsonb) as team_ids,
           -- Stufe (c) der Selbst-Profil-Projektion (0053): laeuft impersoniert,
           -- also ist auth.uid() der/die Betrachter:in -> wahr fuer die eigene
           -- Zeile und die der eigenen Kinder.
           app.can_act_for_member(m.id) as _self_or_guardian
         from app.club_members m
         where m.club_id = ${clubId} and m.deleted_at is null
         order by m.last_name, m.first_name`,
    );
    const mapped = rows.map((row) =>
      redactSelfProfile(
        redactMemberForViewer(withAvatar(row), privileged, joinedOnVisible),
        internalProfileViewer,
      ),
    );
    return c.json(z.array(memberSchema).parse(mapped), 200);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members',
    tags: ['members'],
    summary: 'Create a membership row (can_manage_members)',
    description:
      'Creates a person in the roster (e.g. a child without an account). owner/admin/moderator/treasurer may create; ' +
      'the assigned role is gated by can_change_member_role (treasurer may only create plain members, ' +
      'moderator only ranks below moderator). The owner role is never assignable here.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: memberCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(memberSchema, 'Created membership'),
      409: jsonContent(z.object({}).passthrough(), 'Duplicate'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const callerRole = requireClubRole(c.get('claims'), clubId, MANAGE_MEMBER_ROLES);
    if (!canAssignRole(callerRole, body.role)) {
      throw problem(403, 'Forbidden', `Your role (${callerRole}) may not assign role '${body.role}'`);
    }

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`insert into app.club_members
           (club_id, first_name, last_name, email, birth_date, role, status, joined_on, valid_until)
         values
           (${clubId}, ${body.first_name}, ${body.last_name}, ${body.email ?? null},
            ${body.birth_date ?? null}, ${body.role}, 'active',
            ${body.joined_on ?? null}, ${body.valid_until ?? null})
         returning *`,
    );
    // A brand-new membership row has no team links yet.
    return c.json(memberSchema.parse(withAvatar({ ...rows[0], team_ids: [] })), 201);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members/invite',
    tags: ['members'],
    summary: 'Invite a person by e-mail (stub, can_manage_members)',
    description:
      'Phase-1 stub: validates and logs the invite. Mail delivery + join-code flow land with the portal phase.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: inviteSchema } }, required: true },
    },
    responses: {
      202: jsonContent(
        z.object({ status: z.literal('queued'), email: z.string() }).openapi('InviteQueued'),
        'Invite accepted (stub)',
      ),
      ...errorResponses,
    },
  }),
  (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const callerRole = requireClubRole(c.get('claims'), clubId, MANAGE_MEMBER_ROLES);
    if (!canAssignRole(callerRole, body.role)) {
      throw problem(403, 'Forbidden', `Your role (${callerRole}) may not invite role '${body.role}'`);
    }
    console.info(
      `[members] invite stub: club=${clubId} email=${body.email} role=${body.role} (request ${c.get('requestId')})`,
    );
    return c.json({ status: 'queued' as const, email: body.email }, 202);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/guardianships',
    tags: ['members'],
    summary: 'List guardianships (family model) of a club',
    description:
      'RLS-scoped: owner/admin see all relations, guardians/children only their own family rows.',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(guardianshipSchema), 'Guardianships visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    await requireClubMemberDb(c, clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.guardianships
         where club_id = ${clubId} and deleted_at is null
         order by created_at`,
    );
    return c.json(z.array(guardianshipSchema).parse(rows), 200);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/members/{memberId}',
    tags: ['members'],
    summary: 'Edit member master data (can_manage_members; never the role)',
    description:
      'Updates first/last name, e-mail, birth date, status and validity. The ROLE is deliberately not editable ' +
      'here - use PATCH .../members/{memberId}/role. can_manage_members = owner/admin/moderator/treasurer.',
    security: [{ bearerAuth: [] }],
    request: {
      params: memberParams,
      body: { content: { 'application/json': { schema: memberUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(memberSchema, 'Updated membership'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const body = c.req.valid('json');
    requireClubRole(c.get('claims'), clubId, MANAGE_MEMBER_ROLES);

    const claims = c.get('claims');
    const updated = await withUser(claims, async (tx) => {
      const rows = await tx`
        update app.club_members set ${tx(body)}
        where id = ${memberId} and club_id = ${clubId} and deleted_at is null
        returning *, app.can_act_for_member(id) as _self_or_guardian`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Membership not found');
      return withAvatar({ ...rows[0], team_ids: await teamIdsOf(tx, memberId) });
    });

    // Selbst-Profil-Projektion wie im Roster: ein treasurer (can_manage_members,
    // aber NICHT "Vorstand/Trainer") darf ueber diese Verwaltungs-Antwort kein
    // internes Profil sehen, das ihm der Roster verwehrt.
    const redacted = redactSelfProfile(updated, maySeeInternalSelfProfile(claims, clubId));
    return c.json(memberSchema.parse(redacted), 200);
  },
);

membersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/members/{memberId}/role',
    tags: ['members'],
    summary: 'Change a member role (owner/admin; never self; last owner protected)',
    security: [{ bearerAuth: [] }],
    request: {
      params: memberParams,
      body: { content: { 'application/json': { schema: roleChangeSchema } }, required: true },
    },
    responses: {
      200: jsonContent(memberSchema, 'Updated membership'),
      409: jsonContent(z.object({}).passthrough(), 'Would remove the last owner'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const { role: newRole } = c.req.valid('json');
    const claims = c.get('claims');
    const callerRole = requireClubRole(claims, clubId, ADMIN_ROLES);

    const updated = await withUser(claims, async (tx) => {
      const targets = await tx`
        select id, role, profile_id from app.club_members
        where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
      const target = targets[0];
      if (!target) throw problem(404, 'Not Found', 'Membership not found');

      const owners = await tx`
        select count(*)::int as n from app.club_members
        where club_id = ${clubId} and role = 'owner'
          and status = 'active' and deleted_at is null`;

      const denial = checkRoleChange({
        callerRole,
        callerIsTarget: target['profile_id'] === claims.sub,
        targetRole: target['role'] as ClubRole,
        newRole,
        activeOwnerCount: (owners[0]?.['n'] as number | undefined) ?? 0,
      });
      if (denial) throw denial;

      // Impersonated UPDATE: protect_club_membership fires as defense in depth.
      const rows = await tx`
        update app.club_members set role = ${newRole}
        where id = ${memberId} returning *, app.can_act_for_member(id) as _self_or_guardian`;
      return withAvatar({ ...rows[0], team_ids: await teamIdsOf(tx, memberId) });
    });

    // Rollenwechsel ist ein owner/admin-Recht — beide sind ohnehin
    // "Vorstand/Trainer", aber die Projektion bleibt konsistent angewendet.
    const redacted = redactSelfProfile(updated, maySeeInternalSelfProfile(claims, clubId));
    return c.json(memberSchema.parse(redacted), 200);
  },
);

// ============================================================================
// PATCH /clubs/{clubId}/members/{memberId}/profile — das Selbst-Profil (0045).
//
// Der Befund des Nutzers war "jetzt aktuell geht garnicht" — richtig: die
// Spalten gab es nicht. Jetzt gibt es sie, und dies ist der einzige Weg, sie zu
// beschreiben.
//
// ### WER ###
// Die Person selbst — und bei KINDERN OHNE KONTO (profile_id is null) ihre
// Erziehungsberechtigten. Beides = app.can_act_for_member. Bewusst KEIN
// requireClubRole: das hier ist kein Verwaltungsrecht, sondern das Gegenteil
// davon. Ein Administrator hat hier NICHTS zu suchen — er duerfte sonst einem
// Kind Worte in den Mund legen, die der ganze Verein als dessen Aussage liest.
// Loeschen (Moderation) kann er weiter ueber die normale Zeilen-Verwaltung; der
// Trigger app.protect_self_profile trennt Leeren von Schreiben.
//
// ### WO DIE DURCHSETZUNG STEHT (nicht hier) ###
// app.set_self_profile (0045) prueft can_act_for_member und kann per Bauart nur
// die drei Profilspalten schreiben; der Trigger prueft zusaetzlich status=active
// (der pending-Antragsteller ist noch kein Mitglied) und die Urheberschaft; die
// CHECK-Constraints pruefen Laenge und die Kontaktdaten-Leitplanke.
// Diese Route ist die Tuer, nicht das Schloss — die Fehler kommen aus der DB und
// die Middleware uebersetzt sie (P0001 -> 403, 23514 -> 422).
// ============================================================================
membersRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/members/{memberId}/profile',
    tags: ['members'],
    summary: 'Edit the SELF profile (own row or own child; never by managers)',
    description:
      'Das Selbst-Profil pflegt die Person SELBST — bei Kindern ohne Konto ihre Erziehungsberechtigten ' +
      '(app.guardianships). Schreibrecht ist ausdruecklich KEIN Verwaltungsrecht: owner/admin/moderator ' +
      'koennen fremde Profile NICHT beschreiben (sie duerfen sie leeren — Moderation). ' +
      'Felder: motto (max. 140), favorite_discipline (max. 60), skating_since (Jahreszahl). ' +
      'Fehlender Schluessel = unveraendert, null oder "" = Angabe loeschen. ' +
      'Die Inhalte sind fuer ALLE aktiven Mitglieder des Vereins sichtbar — serverseitig werden ' +
      'hineinkopierte E-Mail-Adressen, Links und Telefonnummern am Stueck abgelehnt (422).',
    security: [{ bearerAuth: [] }],
    request: {
      params: memberParams,
      body: { content: { 'application/json': { schema: memberSelfProfileUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(memberSchema, 'Updated membership'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    await requireClubMemberDb(c, clubId);

    const updated = await withUser(claims, async (tx) => {
      // Die Rechtepruefung steckt in der Funktion (can_act_for_member) + im
      // Trigger. Hier wird bewusst NICHT vorgeprueft: zwei Meinungen ueber
      // dasselbe Recht laufen frueher oder spaeter auseinander, und die
      // massgebliche ist die der Datenbank.
      // tx.json(body) und NICHT JSON.stringify(body): postgres.js kodiert einen
      // JS-STRING fuer ein jsonb-Ziel ein ZWEITES Mal. Aus dem Objekt wird dann
      // ein jsonb-SKALAR vom Typ "string", `p_patch ? 'motto'` ist false, jedes
      // Feld faellt in den else-Zweig ("unveraendert") — und die Route
      // antwortete 200, ohne irgendetwas zu schreiben. Gemessen:
      //   JSON.stringify(body)::jsonb -> jsonb_typeof = 'string', ? 'motto' = false
      //   tx.json(body)::jsonb        -> jsonb_typeof = 'object', ? 'motto' = true
      // Der Fehler war STILL (200 + null), nicht laut — gefunden hat ihn erst
      // der Smoke ueber HTTP; die SQL-Tests liefen mit jsonb-Literalen daran
      // vorbei. app.set_self_profile wirft seit diesem Befund bei allem, was
      // kein jsonb-Objekt ist.
      await tx`select app.set_self_profile(${clubId}::uuid, ${memberId}::uuid, ${tx.json(body)}::jsonb)`;
      const rows = await tx`
        select m.*, app.can_act_for_member(m.id) as _self_or_guardian from app.club_members m
        where m.id = ${memberId} and m.club_id = ${clubId} and m.deleted_at is null`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Membership not found');
      return withAvatar({ ...rows[0], team_ids: await teamIdsOf(tx, memberId) });
    });

    // Dieselbe Redigierung wie im Roster. Ein Elternteil sieht hier also nicht
    // mehr, als es im Roster ohnehin saehe — die Antwort einer Schreib-Route
    // darf kein zweiter Lese-Pfad an der eigenen Redigierung vorbei sein.
    // Wer schreiben durfte, ist can_act_for_member -> _self_or_guardian ist wahr
    // -> das eigene Selbst-Profil (inkl. Stufe) bleibt in der Antwort sichtbar.
    const redacted = redactSelfProfile(
      redactMemberForViewer(updated, maySeeFullRoster(claims, clubId), maySeeJoinedOn(claims, clubId)),
      maySeeInternalSelfProfile(claims, clubId),
    );
    return c.json(memberSchema.parse(redacted), 200);
  },
);
