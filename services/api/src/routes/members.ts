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

import { createHash, randomBytes } from 'node:crypto';
import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  guardianshipSchema,
  inviteQueuedSchema,
  inviteSchema,
  memberCreateSchema,
  memberSchema,
  memberSelfProfileUpdateSchema,
  memberUpdateSchema,
  problemSchema,
  roleChangeSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import type { Tx } from '../db.js';
import { getConfig } from '../config.js';
import { problem } from '../middleware/error.js';
import { avatarUrlFor } from '../lib/avatar.js';
import { sendMail, MailConfigError } from '../lib/mailer.js';
import { renderClubInvitation } from '../lib/mail-templates/index.js';
import { clientIp, enforceRateLimits } from '../lib/rate-limit.js';
import {
  ADMIN_ROLES,
  MANAGE_MEMBER_ROLES,
  canAssignRole,
  checkRoleChange,
  clubRoleHeld,
  hasClubRole,
  isPlatformAdmin,
  requireClubRole,
} from '../lib/guards.js';
import { operatorMay } from '../lib/operator-capabilities.js';
import { capsFor, requireClubMemberDb, requireClubRoleDb } from '../lib/capabilities.js';
import type { AuthClaims, ClubRole } from '../middleware/auth.js';

/** Gueltigkeitsdauer einer Einladung: 14 Tage (wie im Auftrag vorgesehen). */
const INVITE_TTL_DAYS = 14;

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
 * Foto-Anzeige-Wache fuer das Roster (Kinderschutz): das Profilfoto (avatar_url)
 * wird — wie die Galerie (0056: app.has_internal_photo_consent) — NUR bei
 * wirksamer 'photos_internal'-Einwilligung gezeigt, ROLLENUNABHAENGIG. Ausnahme:
 * die betroffene Person selbst und ihre Vormuende sehen ihr Foto immer.
 * Ohne diese Wache waeren die Gesichter (auch der vielen Kinder) fuer das ganze
 * Verzeichnis sichtbar, obwohl members.ts keine Einwilligung prueft.
 * Erwartet die SQL-Zusatzspalten `_photo_consent` (app.has_internal_photo_consent)
 * und `_self_or_guardian` (app.can_act_for_member) auf der Zeile.
 */
export function gateAvatarConsent<T extends Record<string, unknown> & { avatar_url: string | null }>(
  row: T,
): T {
  const consented = row['_photo_consent'] === true;
  const selfOrGuardian = row['_self_or_guardian'] === true;
  if (consented || selfOrGuardian) return row;
  return { ...row, avatar_url: null };
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
// ### 0054: die KONTAKTdaten zerfallen in ZWEI Gruppen, weil sie zwei Publika haben ###
// Der coach soll die ELTERN seiner Team-Kinder erreichen (E-Mail/Telefon/
// Anschrift/Geburtstag) — er soll NICHT die Verwaltungs-Innereien (Ablauf des
// Gastzugangs, die Konto-Verknuepfung profile_id) sehen. "Kontaktdaten fuer den
// Trainer" heisst genau die vier, nicht "alle PII-Spalten". Ein Gate, das fuenf
// Spalten auf einmal freigibt, kann diese Anforderung nicht ausdruecken — daher
// zwei Listen.
//
// PARENT: was eine Trainer:in braucht, um die Eltern zu erreichen. Sichtbar fuer
//   can_manage_members + Plattform-Admin (immer) ODER den coach eines Teams, in
//   dem die Zielperson Mitglied ist (maySeeContactOf, ZEILENweise).
const CONTACT_PARENT_FIELDS = ['birth_date', 'email', 'phone', 'postal_address'] as const;
// ADMIN: Verwaltungs-Kontakt. NUR can_manage_members + Plattform-Admin — NIE ein
//   coach. valid_until ist der Gast-Ablauf, profile_id die Konto-Verknuepfung;
//   beides ist Verwaltung, kein Elternkontakt.
const CONTACT_ADMIN_FIELDS = ['valid_until', 'profile_id'] as const;

/** Eigenes Gate, eigene Liste — siehe oben. */
const JOINED_ON_FIELDS = ['joined_on'] as const;

/**
 * Verstecktes Abfrage-Feld: pro Roster-Zeile true, wenn der/die BETRACHTER:IN ein
 * Team betreut, in dem DIESE Zielperson Mitglied ist (SQL: exists over
 * team_members ∩ app.coached_team_ids). Von den Roster-/DM-Abfragen mitselektiert,
 * von maySeeContactOf gelesen und von redactMemberForViewer entfernt (damit es
 * nicht im Contract landet — memberSchema.parse verwuerfe es ohnehin).
 */
const COACH_OF_MEMBER_KEY = '_coach_of_member';

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
  // 0075: 'member_contact' — die Faehigkeit, die 0074 mit Begruendung GESPERRT
  // hat („Adresse, Telefon, Geburtsdatum. Fuer den Support nicht noetig").
  // Vorher lief der Betreiber hier ueber den pauschalen Override durch und las
  // Geburtsdatum von 15 Minderjaehrigen sowie Telefon/Anschrift von 5.
  return hasClubRole(claims, clubId, MANAGE_MEMBER_ROLES, 'member_contact');
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
  // 'anniversaries' ist freigegeben (0074, mit Begruendung: rein abgeleitet aus
  // members). joined_on und die Jubilaeumsliste sind damit DIESELBE Entscheidung
  // — was der Kopf dieser Funktion ohnehin verlangt.
  return hasClubRole(claims, clubId, JOINED_ON_ROLES, 'anniversaries');
}

/**
 * ZEILENWEISE Kontaktdaten-Sichtbarkeit (0054, Kernaufgabe). Anders als
 * maySeeFullRoster/maySeeJoinedOn (die pro BETRACHTER entscheiden) haengt DIESE
 * Frage vom PAAR (Betrachter × Zielzeile) ab: "darf dieser coach DIESE Person
 * sehen?" — und das ist genau dann wahr, wenn der coach ein Team betreut, in dem
 * die Zielperson Mitglied ist.
 *
 * Zwei Wege, wahr zu werden:
 *   * privilegiert (can_manage_members / Plattform-Admin) — sieht ALLE, wie bisher.
 *   * der/die Betrachter:in ist coach (CLUB-Rolle 'coach') UND die Zielzeile
 *     traegt _coach_of_member = true (die SQL-Abfrage hat den Team-Schnitt schon
 *     unter Impersonation ausgerechnet).
 *
 * ⚠️ guest_coach ist BEWUSST DRAUSSEN (wie bei joined_on). Die DB-Funktion
 * coached_team_ids kennt keinen Rollen-Unterschied — ein Gast-Trainer betreut
 * team_members role=coach genauso, also waere _coach_of_member fuer ihn auch
 * true. Der Ausschluss sitzt HIER im Claims-Check (hasClubRole ['coach'], nicht
 * COACH_ROLES): der Gast ist vereinsEXTERN auf Zeit und hat mit den Eltern-
 * kontakten der Kinder nichts zu tun. Im Zweifel strenger.
 *
 * DIE FUNKTION FUER DIE AGGREGAT-PHASE: pro (viewer, targetMemberRow) aufrufbar.
 * Die Zeile MUSS _coach_of_member tragen (aus der SQL unten); fehlt es (z.B. ein
 * frisch angelegter Antrag ohne Team), wertet es als false -> fail-closed.
 */
export function maySeeContactOf(
  claims: AuthClaims,
  clubId: string,
  row: Record<string, unknown>,
): boolean {
  if (maySeeFullRoster(claims, clubId)) return true;
  // clubRoleHeld und nicht hasClubRole: „ist diese Person Trainerin" ist eine
  // TATSACHE ueber die Vereinsrolle, keine Befugnis. Kein Betreiber-Zweig —
  // derselbe Schnitt wie app.coaches_member in 0075.
  if (!clubRoleHeld(claims, clubId, ['coach'])) return false;
  return row[COACH_OF_MEMBER_KEY] === true;
}

/**
 * Null out the sensitive columns of a roster row for a viewer. The keys stay
 * present (memberSchema requires them, nullable) so the response shape is
 * unchanged — no contract break, just redacted values.
 *
 * Drei unabhaengige Achsen, jede mit eigenem Gate:
 *   * `privileged` (can_manage_members / Plattform-Admin): sieht die VERWALTUNGS-
 *     Kontaktfelder (valid_until, profile_id) UND — per Default auch — die
 *     Parent-Kontaktfelder und joined_on.
 *   * `contactVisible` (Default = privileged): sieht die PARENT-Kontaktfelder
 *     (birth_date, email, phone, postal_address). Ein coach setzt das ZEILENWEISE
 *     ueber true (maySeeContactOf), OHNE privileged zu sein — dann kommen die
 *     Elternkontakte, aber valid_until/profile_id bleiben null.
 *   * `joinedOnVisible` (Default = privileged): joined_on.
 *
 * Alte Zwei-/Drei-Argument-Aufrufe verhalten sich unveraendert: contactVisible
 * faellt per Default mit privileged, also faellt fuer Nicht-Privilegierte alles.
 * Das versteckte _coach_of_member wird immer entfernt (Contract-Hygiene).
 */
export function redactMemberForViewer<T extends Record<string, unknown>>(
  row: T,
  privileged: boolean,
  joinedOnVisible: boolean = privileged,
  contactVisible: boolean = privileged,
): T {
  const out: Record<string, unknown> = { ...row };
  delete out[COACH_OF_MEMBER_KEY];
  if (!contactVisible) for (const field of CONTACT_PARENT_FIELDS) out[field] = null;
  if (!privileged) for (const field of CONTACT_ADMIN_FIELDS) out[field] = null;
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
      'REDIGIER-Stufen: die Parent-KONTAKTdaten (birth_date, email, phone, postal_address) ' +
      'sehen can_manage_members (treasurer/moderator/admin/owner) + Plattform-Admins IMMER, und ' +
      'ein coach (NICHT guest_coach) ZEILENWEISE fuer Mitglieder seiner eigenen Teams (um deren ' +
      'Eltern zu erreichen); die Verwaltungs-Kontaktdaten (valid_until, profile_id) bleiben ' +
      'can_manage_members vorbehalten (nie dem coach); joined_on sieht zusaetzlich der coach ' +
      '("Trainer und hoeher", ohne guest_coach). Redigierte Spalten bleiben als null im Ergebnis.',
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
           app.can_act_for_member(m.id) as _self_or_guardian,
           -- Foto-Anzeige-Wache (Kinderschutz, 0056): zeigt das Roster-Foto nur
           -- bei wirksamer 'photos_internal'-Einwilligung (rollenunabhaengig).
           app.has_internal_photo_consent(m.id) as _photo_consent,
           -- Zeilenweise Kontakt-Sichtbarkeit (0054): betreut der/die BETRACHTER:IN
           -- ein Team, in dem DIESE Person Mitglied ist? Laeuft impersoniert ->
           -- coached_team_ids sieht auth.uid() als Trainer:in. Dieselbe Bauart wie
           -- die Gesundheitsdaten-Sicht (0040). Der guest_coach-Ausschluss sitzt
           -- NICHT hier (die Funktion kennt keine Rolle), sondern in maySeeContactOf.
           exists (
             select 1 from app.team_members tm
             where tm.member_id = m.id and tm.deleted_at is null
               and tm.team_id = any (app.coached_team_ids(m.club_id))
           ) as _coach_of_member
         from app.club_members m
         where m.club_id = ${clubId} and m.deleted_at is null
         order by m.last_name, m.first_name`,
    );
    const mapped = rows.map((row) =>
      redactSelfProfile(
        redactMemberForViewer(
          gateAvatarConsent(withAvatar(row)),
          privileged,
          joinedOnVisible,
          maySeeContactOf(claims, clubId, row),
        ),
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
    summary: 'Einladung per E-Mail verschicken / Invite a person by e-mail (can_manage_members)',
    description:
      'Legt eine Einladung an (nur der Token-HASH landet in der DB, Klartext nur in der Mail) und verschickt einen ' +
      'Annahme-Link. ENUMERATIONSSICHER: antwortet IMMER 202, egal ob die Adresse schon Mitglied ist, neu ' +
      'eingeladen oder eine offene Einladung aufgefrischt wurde. Empfaenger-gedrosselt (recipient-Achse). Ohne ' +
      'SMTP-Konfiguration bleibt die Einladung bestehen (resend-bar) und der Fehler wird sprechend geloggt statt ' +
      'zu crashen. Erfordert members:manage; die Zielrolle muss der Aufrufer vergeben duerfen (canAssignRole).',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: inviteSchema } }, required: true },
    },
    responses: {
      202: jsonContent(inviteQueuedSchema, 'Einladung angenommen (immer identisch, kein Enumerations-Leck)'),
      422: jsonContent(problemSchema, 'Rolle per E-Mail nicht einladbar (z.B. guest_coach)'),
      429: jsonContent(problemSchema, 'Zu viele Einladungen (RFC 7807 + Retry-After)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    // guest_coach ist ein vereinsEXTERNER Zeitzugang: club_members verlangt fuer
    // ihn valid_until (0002, club_members_guest_coach_needs_expiry). Eine
    // E-Mail-Einladung traegt kein Ablaufdatum -> die Annahme wuerde am CHECK
    // scheitern. Also hier klar abweisen statt spaeter unverstaendlich zu
    // scheitern.
    if (body.role === 'guest_coach') {
      throw problem(
        422,
        'Unprocessable Entity',
        'guest_coach kann nicht per E-Mail eingeladen werden (er braucht ein Ablaufdatum). ' +
          '/ guest_coach cannot be invited by e-mail (it requires an explicit expiry).',
      );
    }

    // Gate DB-aufgeloest (MANAGE_MEMBER_ROLES = Vorstand/Verwaltung), NICHT aus
    // dem Token: so kann auch der frisch angelegte Inhaber sofort einladen (sein
    // Token kennt den neuen Verein noch nicht) — dieselbe Begruendung wie bei
    // approve (registration.ts). Rollenbasiert und deckungsgleich mit der RLS
    // der Einladungstabelle (invitations_insert, 0065): 'members:manage' ist
    // write_only und darf die LESE-Policy nicht gaten (93j).
    await requireClubRoleDb(c, clubId, MANAGE_MEMBER_ROLES, 'members');

    // Rollen-Rang: darf DIESE Person die ZIELrolle vergeben? Mehrfachrollen
    // zaehlen — irgendeine der eigenen Rollen muss reichen. Ohne diese Pruefung
    // koennte ein Kassenwart (members:manage) eine admin-Einladung verschicken.
    const caps = await capsFor(c, clubId);
    const callerRoles = caps.roleKeys as ClubRole[];
    // 0075: operatorMay('roles') statt isPlatformAdmin — 'roles' ist freigegeben
    // (0074: „der haeufigste Support-Fall ueberhaupt"), also aendert sich fuer den
    // eingeschalteten Betreiber nichts. Weg faellt der protokoll-FREIE Zweig: der
    // blosse Claim vergibt keine Rollen mehr, wie in app.can_change_member_role.
    const mayAssign =
      operatorMay(claims, 'roles') || callerRoles.some((r) => canAssignRole(r, body.role));
    if (!mayAssign) {
      throw problem(403, 'Forbidden', `Deine Rolle darf die Rolle '${body.role}' nicht einladen.`);
    }

    const email = body.email.trim().toLowerCase();

    // Empfaenger-Drossel (die vierte Achse, rate-limit.ts): schuetzt die
    // EINGELADENE Adresse vor Zumuellung — unabhaengig davon, wer sendet.
    // account/ip bremsen zusaetzlich den einen Absender.
    await enforceRateLimits(c, [
      { scope: 'account', identifier: claims.sub, limit: 60, window: '1 hour' },
      { scope: 'ip', identifier: clientIp(c), limit: 120, window: '1 hour' },
      { scope: 'recipient', identifier: email, limit: 5, window: '1 hour' },
    ]);

    // 256 Bit CSPRNG. Der Klartext lebt NUR hier (und gleich in der Mail); die
    // DB bekommt ausschliesslich den SHA-256.
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('base64url');

    // Alles in EINER RLS-Transaktion. Der Einladende HAT members:manage — die
    // Policies invitations_insert/_update lassen ihn also durch (zweite Linie).
    const outcome = await withUser(claims, async (tx) => {
      // Schon Mitglied (per E-Mail-Spalte, jeder Status)? Dann NICHTS tun und
      // trotzdem 202 — die Antwort verraet nicht, dass es die Adresse schon
      // gibt (Enumerationsschutz).
      const already = await tx<{ one: number }[]>`
        select 1 as one from app.club_members
        where club_id = ${clubId} and lower(email) = ${email} and deleted_at is null
        limit 1`;
      if (already.length > 0) return { kind: 'already_member' as const };

      // Abgelaufene offene Einladungen dieser Adresse auf 'expired' drehen,
      // damit der Teil-Index (eine OFFENE je Adresse) einer Neu-Einladung nicht
      // im Weg steht.
      await tx`
        update app.invitations set status = 'expired'
        where club_id = ${clubId} and email = ${email}
          and status = 'pending' and expires_at <= now()`;

      // Offene Einladung AUFFRISCHEN (neuer Token/Ablauf/Rolle) ODER neu anlegen.
      // expires_at wird in SQL gerechnet (now() + Intervall), NICHT als
      // JS-Date gebunden: der Treiber (db.ts, custom date-Typ) erwartet fuer
      // Zeitstempel einen String — ein Date-Objekt bricht den Bind. Dieselbe
      // Schreibweise wie beim Code-Rotieren (registration.ts).
      const refreshed = await tx<{ id: string }[]>`
        update app.invitations
           set token_hash            = ${tokenHash},
               target_role           = ${body.role},
               expires_at            = now() + (${INVITE_TTL_DAYS} || ' days')::interval,
               invited_by_member_id  = app.own_member_id(${clubId}),
               invited_by_profile_id = ${claims.sub}
         where club_id = ${clubId} and email = ${email} and status = 'pending'
        returning id`;
      if (refreshed.length === 0) {
        await tx`
          insert into app.invitations
            (club_id, email, target_role, token_hash, invited_by_member_id, invited_by_profile_id, expires_at)
          values
            (${clubId}, ${email}, ${body.role}, ${tokenHash},
             app.own_member_id(${clubId}), ${claims.sub},
             now() + (${INVITE_TTL_DAYS} || ' days')::interval)`;
      }

      // Vereinsname + Einlader-Name fuer die Mail (beides darf der Einladende
      // sehen: eigener Verein, eigene Mitgliedszeile).
      const meta = await tx<{ club_name: string; inviter: string | null }[]>`
        select c.name as club_name,
               (select m.first_name || ' ' || m.last_name
                  from app.club_members m
                 where m.id = app.own_member_id(${clubId})) as inviter
        from app.clubs c
        where c.id = ${clubId} and c.deleted_at is null`;
      return {
        kind: 'invited' as const,
        clubName: meta[0]?.club_name ?? '',
        inviter: meta[0]?.inviter ?? undefined,
      };
    });

    // Mail NUR bei echter Einladung und AUSSERHALB der Transaktion (SMTP wuerde
    // sonst die DB-Verbindung halten). Der Klartext-Token geht in den Link.
    if (outcome.kind === 'invited') {
      const acceptUrl = `${getConfig().appBaseUrl}/einladung/${token}`;
      const mail = renderClubInvitation({
        clubName: outcome.clubName,
        acceptUrl,
        // exactOptionalPropertyTypes: nur setzen, wenn vorhanden (kein
        // explizites undefined uebergeben).
        ...(outcome.inviter ? { inviterName: outcome.inviter } : {}),
      });
      try {
        const result = await sendMail(email, mail);
        if (result.mode === 'dry-run') {
          // Im Trockenlauf steht der Annahme-Link im Log — so ist die Kette
          // ohne echten Mailserver testbar.
          console.info(`[members] invite dry-run club=${clubId} accept-link: ${acceptUrl}`);
        } else {
          console.info(
            `[members] invite sent club=${clubId} accepted=${result.accepted.length} ` +
              `rejected=${result.rejected.length} (request ${c.get('requestId')})`,
          );
        }
      } catch (err) {
        // SAUBERER DEV-FALLBACK, KEIN CRASH. Fehlt die SMTP-Config
        // (MailConfigError), bleibt die Einladung bestehen (sie ist resend-bar)
        // und wir loggen SPRECHEND. Ein echter SMTP-/Netzfehler wird ebenfalls
        // geloggt — die Antwort bleibt 202, damit sie kein Enumerations-Orakel
        // wird. In dev/dry-run zusaetzlich der Annahme-Link, damit die Kette
        // ohne Postfach pruefbar bleibt.
        const isConfig = err instanceof MailConfigError;
        console.warn(
          `[members] invite: Mailversand ${isConfig ? 'nicht konfiguriert' : 'fehlgeschlagen'} ` +
            `(Einladung bleibt bestehen, resend moeglich): ${err instanceof Error ? err.message : String(err)}`,
        );
        const cfg = getConfig();
        if (cfg.auth.mode === 'dev' || cfg.mail.transport === 'dry-run') {
          console.info(`[members] invite dev accept-link: ${acceptUrl}`);
        }
      }
    }

    // IMMER dieselbe Antwort. 202 = "angenommen, wird verarbeitet".
    return c.json({ status: 'queued' as const, email }, 202);
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

// ============================================================================
// DELETE /clubs/{clubId}/members/{memberId} — Mitglied soft-loeschen.
//
// Soft-Delete = deleted_at setzen (kein Hard-DELETE; PowerSync-Tombstone, 0003),
// genau wie deleteTeam. Gate: can_manage_members (MANAGE_MEMBER_ROLES) — der
// API-Guard ist die erste Linie, club_members_update (has_cap members:manage,
// 0026) die zweite.
//
// ### SICHERHEIT: der LETZTE aktive owner ist nie loeschbar ###
// Verschwaende der Verein seine einzige Inhaber:in, koennte niemand mehr Rollen
// vergeben oder Owner nachziehen — der Verein saesse sich selbst aus. Diese
// Regel kennt nur die API zeilenweise (dieselbe Bauart wie checkRoleChange, das
// die letzte owner-DEGRADIERUNG verhindert); der Trigger protect_club_membership
// schuetzt zwar owner-Rollen, kann „letzter seiner Art" aber nicht wissen. -> 409.
// ============================================================================
membersRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/clubs/{clubId}/members/{memberId}',
    tags: ['members'],
    summary: 'Soft-delete a membership (can_manage_members; never the last active owner)',
    description:
      'Setzt deleted_at auf der Mitgliedszeile (Soft-Delete/Tombstone, 0003) und loest die ' +
      'Team-Verknuepfungen, damit die Person aus den Team-Rostern verschwindet. can_manage_members ' +
      '(owner/admin/moderator/treasurer). SICHERHEIT: das LETZTE aktive owner-Mitglied ist nie ' +
      'loeschbar (sonst sperrt sich der Verein aus) -> 409.',
    security: [{ bearerAuth: [] }],
    request: { params: memberParams },
    responses: {
      200: jsonContent(deletedSchema, 'Membership soft-deleted'),
      409: jsonContent(z.object({}).passthrough(), 'Would remove the last active owner'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubRole(claims, clubId, MANAGE_MEMBER_ROLES);

    // Existenz + letzter-Owner-Schutz + Soft-Delete unter RLS (impersoniert):
    // club_members_update erzwingt can_manage_members noch einmal, der Trigger
    // protect_club_membership ist die dritte Linie.
    await withUser(claims, async (tx) => {
      const targets = await tx`
        select id, role from app.club_members
        where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
      const target = targets[0];
      if (!target) throw problem(404, 'Not Found', 'Membership not found');

      if (target['role'] === 'owner') {
        const owners = await tx`
          select count(*)::int as n from app.club_members
          where club_id = ${clubId} and role = 'owner'
            and status = 'active' and deleted_at is null`;
        const activeOwners = (owners[0]?.['n'] as number | undefined) ?? 0;
        if (activeOwners <= 1) {
          throw problem(409, 'Conflict', 'Cannot delete the last active owner of the club');
        }
      }

      // KEIN `returning` auf der eben getilgten Zeile (RETURNING-Fallstrick wie
      // beim Event-Soft-Delete): Existenz ist oben belegt, die Autorisierung
      // steht (requireClubRole == club_members_update-Policy).
      await tx`
        update app.club_members set deleted_at = now()
        where id = ${memberId} and club_id = ${clubId} and deleted_at is null`;
    });

    // Roster-Verknuepfungen als FOLGE der (bereits abschliessend autorisierten)
    // Entfernung loesen — wie deleteTeam die team_members tilgt. Bewusst als
    // SERVICE-Operation: ein Kassenwart hat can_manage_members, aber KEIN
    // team_members-Schreibrecht (RLS 0031 verlangt owner/admin/moderator/coach
    // bzw. team_coaches:manage) — unter Impersonation scheiterte genau dieses
    // Detachment mit 42501 und liesse die Person als tote Referenz im Team-Roster
    // stehen. Die Berechtigung, das Mitglied zu entfernen, ist oben geprueft.
    await withServiceRole(
      `member ${memberId} soft-deleted in club ${clubId}: detach team links (caller ${claims.sub})`,
      (tx) =>
        tx`update app.team_members set deleted_at = now()
           where member_id = ${memberId} and club_id = ${clubId} and deleted_at is null`,
    );

    return c.json({ status: 'deleted' as const, id: memberId }, 200);
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
