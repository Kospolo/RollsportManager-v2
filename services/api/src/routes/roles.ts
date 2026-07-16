// ============================================================================
// routes/roles.ts - die Schreibseite des Rechte-Systems (RBAC-DESIGN §6/§7).
//
// Aus der bisher statischen Rechte-Matrix wird die editierbare Steuerzentrale:
// Rollen anlegen/umbenennen/loeschen, die Matrix je Rolle setzen, einer Person
// MEHRERE Rollen geben, einem Team mehrere Trainer:innen.
//
// ### Zwei Verteidigungslinien, nicht eine ###
// Alles laeuft durch withUser -> RLS + Schutz-Trigger bleiben wirksam. KEIN
// Service-Mode: die Endpoints hier legen keine System-Daten an, sie aendern
// Rechte — genau der Ort, an dem ein Guard-Fehler sonst unbemerkt bliebe.
// Die API-Gates sind dabei deckungsgleich mit den Policies (gegen den Seed
// nachgerechnet):
//   roles >= manage = {owner,admin,moderator}        == is_club_admin (0022:212)
//   teams >= manage = {owner,admin,moderator,coach}  == team_members_insert (0007:281)
//
// ### Warum hier ueberhaupt Handarbeit noetig ist ###
// Die Trigger werfen P0001, FK-Verletzungen kommen als 23503. Beides wuerde die
// Fehler-Middleware auf 403/422 abbilden — fachlich richtig waere aber oft 409
// ("die Rolle ist noch vergeben", "die Person ist schon Skater im Team"). Die
// Handarbeit unten faengt genau diese Faelle VOR dem Trigger ab und gibt einen
// Text, den ein Mensch versteht (DE+EN). Der Trigger bleibt trotzdem stehen:
// er ist das Netz, nicht die Fehlermeldung.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  capabilitySchema,
  clubRoleDefCreateSchema,
  clubRoleDefSchema,
  clubRoleDefUpdateSchema,
  deletedSchema,
  memberRolesSetSchema,
  rolePermissionSchema,
  rolePermissionSetSchema,
  teamCoachesSetSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';
import { requireCap } from '../lib/capabilities.js';

export const rolesRouter = createRouter();

const clubParam = z.object({ clubId: uuid });
const roleParam = z.object({ clubId: uuid, roleId: uuid });

/** Die Rolle laden und zugleich pruefen, dass sie zu DIESEM Verein gehoert. */
async function loadRole(tx: Tx, clubId: string, roleId: string): Promise<Record<string, unknown>> {
  const rows = await tx`
    select id, club_id, key, name_de, name_en, is_system, protected, sort, created_at, updated_at
    from app.roles where id = ${roleId} and club_id = ${clubId}`;
  const role = rows[0];
  if (!role) throw problem(404, 'Not Found', 'Rolle nicht gefunden. / Role not found.');
  return role;
}

// ---------------------------------------------------------------------------
// GET /capabilities - der globale Katalog (app.capabilities).
// Kein Verein noetig: der Katalog ist global (0022:58-60), konfigurierbar sind
// die STUFEN, nicht die Faehigkeiten. RLS: capabilities_select using(true).
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/capabilities',
    tags: ['roles'],
    summary: 'Der globale Faehigkeiten-Katalog (bilingual, mit waehlbaren Stufen)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(capabilitySchema), 'Alle Faehigkeiten, nach sort'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    const rows = await withUser(claims, (tx) =>
      tx`select key, label_de, label_en, allowed_levels, sort
         from app.capabilities order by sort, key`,
    );
    return c.json(z.array(capabilitySchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /clubs/{clubId}/roles - die Rollen des Vereins.
// Lesen = jedes Mitglied (roles_select = is_club_member, 0022:208): das Admin-UI
// und die Personen-Chips muessen die Rollen benennen koennen.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/roles',
    tags: ['roles'],
    summary: 'Die Rollen des Vereins (Systemrollen + eigene)',
    security: [{ bearerAuth: [] }],
    request: { params: clubParam },
    responses: {
      200: jsonContent(z.array(clubRoleDefSchema), 'Rollen, nach sort'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    const rows = await withUser(claims, (tx) =>
      tx`select id, club_id, key, name_de, name_en, is_system, protected, sort,
                created_at, updated_at
         from app.roles where club_id = ${clubId} order by sort, key`,
    );
    return c.json(z.array(clubRoleDefSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /clubs/{clubId}/roles/{roleId}/permissions - die Matrix EINER Rolle.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/roles/{roleId}/permissions',
    tags: ['roles'],
    summary: 'Die Rechte-Matrix einer Rolle',
    security: [{ bearerAuth: [] }],
    request: { params: roleParam },
    responses: {
      200: jsonContent(z.array(rolePermissionSchema), 'Faehigkeit -> Stufe'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, roleId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    const rows = await withUser(claims, async (tx) => {
      await loadRole(tx, clubId, roleId);
      return tx`
        select rp.capability_key, rp.level
        from app.role_permissions rp
        join app.capabilities c on c.key = rp.capability_key
        where rp.role_id = ${roleId} and rp.club_id = ${clubId}
        order by c.sort, c.key`;
    });
    return c.json(z.array(rolePermissionSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/roles - eine EIGENE Rolle anlegen (§1.2).
// is_system/protected werden hier hart auf false gesetzt - sie stehen nicht im
// Body-Schema, koennen also gar nicht erst hereingereicht werden.
// Eine neue Rolle startet OHNE Rechte (keine role_permissions-Zeilen ->
// cap_rank = 0): fail-closed. Rechte kommen per PUT .../permissions.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/roles',
    tags: ['roles'],
    summary: 'Eine eigene Rolle anlegen (startet ohne Rechte)',
    description:
      'Legt eine Vereins-eigene Rolle an. Sie beginnt ohne jede Berechtigung (fail-closed); die ' +
      'Stufen werden anschliessend per PUT /clubs/{clubId}/roles/{roleId}/permissions gesetzt. ' +
      'Systemrollen lassen sich hierueber nicht erzeugen.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubParam,
      body: { content: { 'application/json': { schema: clubRoleDefCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(clubRoleDefSchema, 'Die angelegte Rolle'),
      409: jsonContent(z.object({}).passthrough(), 'Der Schluessel ist im Verein schon vergeben'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    await requireCap(c, clubId, 'roles', 'manage');

    const role = await withUser(claims, async (tx) => {
      const dup = await tx`select 1 from app.roles where club_id = ${clubId} and key = ${body.key}`;
      if (dup.length > 0) {
        throw problem(
          409,
          'Conflict',
          `Der Rollen-Schluessel "${body.key}" ist in diesem Verein bereits vergeben. ` +
            `/ The role key "${body.key}" already exists in this club.`,
        );
      }
      const rows = await tx`
        insert into app.roles (club_id, key, name_de, name_en, is_system, protected, sort)
        values (${clubId}, ${body.key}, ${body.name_de}, ${body.name_en}, false, false,
                ${body.sort ?? 100})
        returning id, club_id, key, name_de, name_en, is_system, protected, sort,
                  created_at, updated_at`;
      return rows[0];
    });
    return c.json(clubRoleDefSchema.parse(role), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /clubs/{clubId}/roles/{roleId} - umbenennen/umsortieren.
// Auch Systemrollen duerfen umbenannt werden (protect_roles erlaubt name_de/
// name_en ausdruecklich, 0024:256-258) - nur ihr key ist unveraenderlich, und
// der steht gar nicht im Body-Schema.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/roles/{roleId}',
    tags: ['roles'],
    summary: 'Eine Rolle umbenennen oder umsortieren',
    security: [{ bearerAuth: [] }],
    request: {
      params: roleParam,
      body: { content: { 'application/json': { schema: clubRoleDefUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(clubRoleDefSchema, 'Die geaenderte Rolle'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, roleId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    await requireCap(c, clubId, 'roles', 'manage');

    const role = await withUser(claims, async (tx) => {
      await loadRole(tx, clubId, roleId);
      const rows = await tx`
        update app.roles set ${tx(body)}
        where id = ${roleId} and club_id = ${clubId}
        returning id, club_id, key, name_de, name_en, is_system, protected, sort,
                  created_at, updated_at`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Rolle nicht gefunden. / Role not found.');
      return rows[0];
    });
    return c.json(clubRoleDefSchema.parse(role), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE /clubs/{clubId}/roles/{roleId} - eine eigene Rolle loeschen.
//
// Zwei Faelle werden VOR dem Trigger/FK abgefangen, weil sie fachlich 409 sind:
//   * Systemrolle -> protect_roles wuerfe P0001 (-> 403 "Forbidden"), was in die
//     Irre fuehrt: es ist keine Rechtefrage, sondern ein Zustandskonflikt.
//   * noch zugewiesen -> member_roles.role_id ist ON DELETE RESTRICT (0022:152,
//     confdeltype='r' verifiziert) -> 23503 (-> 422). Auch das ist ein Konflikt,
//     kein Validierungsfehler.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/clubs/{clubId}/roles/{roleId}',
    tags: ['roles'],
    summary: 'Eine eigene Rolle loeschen (Systemrollen sind geschuetzt)',
    security: [{ bearerAuth: [] }],
    request: { params: roleParam },
    responses: {
      200: jsonContent(deletedSchema, 'Die Rolle wurde geloescht'),
      409: jsonContent(z.object({}).passthrough(), 'Systemrolle oder noch zugewiesen'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, roleId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    await requireCap(c, clubId, 'roles', 'manage');

    await withUser(claims, async (tx) => {
      const role = await loadRole(tx, clubId, roleId);
      if (role['is_system'] === true) {
        throw problem(
          409,
          'Conflict',
          'Systemrollen koennen nicht geloescht werden — benenne sie um oder entziehe ihre Rechte. ' +
            '/ System roles cannot be deleted — rename them or remove their permissions instead.',
        );
      }
      const assigned = await tx`
        select count(*)::int as n from app.member_roles where role_id = ${roleId}`;
      const n = (assigned[0]?.['n'] as number | undefined) ?? 0;
      if (n > 0) {
        throw problem(
          409,
          'Conflict',
          `Die Rolle ist noch ${n} Person(en) zugewiesen — entziehe sie zuerst. ` +
            `/ The role is still assigned to ${n} person(s) — revoke it first.`,
        );
      }
      await tx`delete from app.roles where id = ${roleId} and club_id = ${clubId}`;
    });
    // 200 + Deleted-Huelle statt 204: Hauskonvention (teams.ts:157 u.a.) und
    // check.mjs verlangt fuer JEDE Operation ein 2xx-JSON-Schema.
    return c.json(deletedSchema.parse({ status: 'deleted', id: roleId }), 200);
  },
);

// ---------------------------------------------------------------------------
// PUT /clubs/{clubId}/roles/{roleId}/permissions - die Matrix setzen (§7).
//
// Zwei Faelle vor dem Trigger:
//   * owner-Rolle ist protected -> 409 (0024:288-290 wuerfe P0001/403)
//   * Stufe ausserhalb allowed_levels -> 422 (Validierung, nicht Rechte)
// Beides bleibt im Trigger stehen: er ist das Netz gegen einen kuenftigen
// Aufrufer, der an dieser Handarbeit vorbeigeht.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/roles/{roleId}/permissions',
    tags: ['roles'],
    summary: 'Die Rechte-Matrix einer Rolle setzen',
    description:
      'Setzt die uebergebenen Faehigkeiten auf die genannten Stufen (Teilmenge erlaubt; nicht ' +
      'genannte Faehigkeiten bleiben unveraendert). Die owner-Rolle ist geschuetzt und kann nicht ' +
      'abgesenkt werden. Wirkt SOFORT — auch fuer bereits angemeldete Personen.',
    security: [{ bearerAuth: [] }],
    request: {
      params: roleParam,
      body: { content: { 'application/json': { schema: rolePermissionSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(z.array(rolePermissionSchema), 'Die gespeicherte Matrix'),
      409: jsonContent(z.object({}).passthrough(), 'Die owner-Rolle ist geschuetzt'),
      422: jsonContent(z.object({}).passthrough(), 'Stufe fuer diese Faehigkeit nicht erlaubt'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, roleId } = c.req.valid('param');
    const { permissions } = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    await requireCap(c, clubId, 'roles', 'manage');

    const rows = await withUser(claims, async (tx) => {
      const role = await loadRole(tx, clubId, roleId);
      if (role['protected'] === true) {
        throw problem(
          409,
          'Conflict',
          'Die Inhaber-Rolle ist geschuetzt — ihre Rechte lassen sich nicht aendern (sonst koennte ' +
            'sich ein Verein selbst aussperren). / The owner role is protected — its permissions ' +
            'cannot be changed (a club could otherwise lock itself out).',
        );
      }

      // Stufe gegen allowed_levels pruefen, BEVOR der Trigger P0001 wirft.
      const catalog = await tx`select key, allowed_levels from app.capabilities`;
      const allowed = new Map(
        catalog.map((r) => [r['key'] as string, r['allowed_levels'] as string[]]),
      );
      for (const p of permissions) {
        const levels = allowed.get(p.capability_key);
        if (!levels) {
          throw problem(
            422,
            'Unprocessable Entity',
            `Unbekannte Faehigkeit "${p.capability_key}". / Unknown capability "${p.capability_key}".`,
          );
        }
        if (!levels.includes(p.level)) {
          throw problem(
            422,
            'Unprocessable Entity',
            `Stufe "${p.level}" ist fuer "${p.capability_key}" nicht zulaessig (erlaubt: ${levels.join(', ')}). ` +
              `/ Level "${p.level}" is not allowed for "${p.capability_key}" (allowed: ${levels.join(', ')}).`,
          );
        }
      }

      for (const p of permissions) {
        await tx`
          insert into app.role_permissions (club_id, role_id, capability_key, level)
          values (${clubId}, ${roleId}, ${p.capability_key}, ${p.level}::app.role_level)
          on conflict (role_id, capability_key) do update set level = excluded.level`;
      }

      return tx`
        select rp.capability_key, rp.level
        from app.role_permissions rp
        join app.capabilities c on c.key = rp.capability_key
        where rp.role_id = ${roleId} and rp.club_id = ${clubId}
        order by c.sort, c.key`;
    });
    return c.json(z.array(rolePermissionSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// PUT /clubs/{clubId}/members/{memberId}/roles - MEHRFACHROLLEN (§1.3).
//
// ### Warum DIFF und nicht "alles loeschen, dann neu anlegen" ###
// Ein truncate+rebuild wuerde fuer JEDE Zeile den Trigger protect_member_roles
// feuern — auch fuer unveraenderte. Dessen Selbstvergabe-Sperre (0024:183-185)
// wirft dann, obwohl sich nichts aendert; und eine unveraenderte owner-Zeile
// liefe gegen "owner nur durch owner". Der Diff fasst nur an, was sich wirklich
// aendert — die Sperren greifen dadurch genau dort, wo sie gemeint sind.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/members/{memberId}/roles',
    tags: ['roles'],
    summary: 'Die Rollen einer Person setzen (mehrere moeglich)',
    description:
      'Setzt den Zielzustand der Rollenzuweisungen. Rechte = Vereinigung ueber alle Rollen ' +
      '(hoechste Stufe je Faehigkeit gewinnt). Wirkt SOFORT, ohne dass sich die Person neu ' +
      'anmelden muss. Nur die tatsaechlichen Aenderungen werden geschrieben.',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid, memberId: uuid }),
      body: { content: { 'application/json': { schema: memberRolesSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(z.array(clubRoleDefSchema), 'Die Rollen der Person nach der Aenderung'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const { role_ids } = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    await requireCap(c, clubId, 'roles', 'manage');

    const rows = await withUser(claims, async (tx) => {
      const member = await tx`
        select id from app.club_members where id = ${memberId} and club_id = ${clubId}`;
      if (member.length === 0) {
        throw problem(404, 'Not Found', 'Mitglied nicht gefunden. / Member not found.');
      }

      // Jede Ziel-Rolle muss zu DIESEM Verein gehoeren (sonst Mandantenbruch;
      // die zusammengesetzte FK member_roles_role_club_fk faengt es ohnehin ab,
      // aber 404 ist die ehrlichere Antwort als ein FK-Fehler).
      if (role_ids.length > 0) {
        const valid = await tx`
          select id from app.roles where club_id = ${clubId} and id = any(${role_ids}::uuid[])`;
        if (valid.length !== new Set(role_ids).size) {
          throw problem(
            404,
            'Not Found',
            'Mindestens eine Rolle gehoert nicht zu diesem Verein. / At least one role does not belong to this club.',
          );
        }
      }

      const current = await tx`select role_id from app.member_roles where member_id = ${memberId}`;
      const have = new Set(current.map((r) => r['role_id'] as string));
      const want = new Set(role_ids);
      const toAdd = [...want].filter((id) => !have.has(id));
      const toRemove = [...have].filter((id) => !want.has(id));

      for (const id of toRemove) {
        await tx`delete from app.member_roles where member_id = ${memberId} and role_id = ${id}`;
      }
      for (const id of toAdd) {
        await tx`insert into app.member_roles (club_id, member_id, role_id)
                 values (${clubId}, ${memberId}, ${id})`;
      }

      return tx`
        select r.id, r.club_id, r.key, r.name_de, r.name_en, r.is_system, r.protected, r.sort,
               r.created_at, r.updated_at
        from app.member_roles mr
        join app.roles r on r.id = mr.role_id
        where mr.member_id = ${memberId}
        order by r.sort, r.key`;
    });
    return c.json(z.array(clubRoleDefSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// PUT /clubs/{clubId}/teams/{teamId}/coaches - Trainer:in <-> mehrere Teams (§1.4).
//
// ### Der Punkt, den die Spec uebersieht ###
// app.team_coaches ist eine VIEW (0025:202) - geschrieben wird app.team_members.
// Dort gilt team_members_uq UNIQUE (team_id, member_id) - OHNE role (gegen \d
// verifiziert). Eine Person ist in einem Team also ENTWEDER Skater ODER Coach.
// Daraus zwei Konsequenzen, die ein naives on-conflict-do-update verletzt haette:
//   * Zielperson hat dort schon eine role <> 'coach'-Zeile -> 409. Ein
//     `do update set role='coach'` wuerde einen Skater STILL aus dem Roster
//     kippen — Datenverlust ohne Fehlermeldung.
//   * Entfernen = SOFT-Delete. Es gibt keine team_members_delete-Policy (gegen
//     pg_policies verifiziert) -> ein DELETE ist RLS-verboten.
// Wieder-Hinzufuegen: der Unique-Index filtert deleted_at NICHT, eine
// soft-geloeschte Zeile blockiert also weiterhin -> reaktivieren statt einfuegen.
// ---------------------------------------------------------------------------
rolesRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/teams/{teamId}/coaches',
    tags: ['roles'],
    summary: 'Die Trainer:innen eines Teams setzen',
    description:
      'Setzt den Zielzustand der Trainer-Zuordnungen eines Teams (n:m — eine Person kann mehrere ' +
      'Teams betreuen). Entfernte Zuordnungen werden soft-geloescht. Wer im Team bereits Skater ' +
      'ist, kann nicht zusaetzlich Trainer:in sein (eine Zeile je Person und Team).',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid, teamId: uuid }),
      body: { content: { 'application/json': { schema: teamCoachesSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(z.array(uuid), 'Die member_ids der Trainer:innen nach der Aenderung'),
      409: jsonContent(z.object({}).passthrough(), 'Die Person ist in diesem Team bereits Skater'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, teamId } = c.req.valid('param');
    const { member_ids } = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    // 'team_coaches' (0031), NICHT 'teams:manage'. Der Unterschied ist der
    // ganze Punkt: 'teams:manage' traegt der coach bereits (rbac_default_level
    // v_structure = owner/admin/moderator/COACH) — genau deshalb konnte sich
    // Sandra Vogel (coach) hier selbst zur Trainerin eines FREMDEN Teams
    // machen (live belegt: HTTP 200) und sah danach dessen Kueren.
    // 'team_coaches' startet auf manage NUR fuer owner/admin/moderator.
    // Die DB haelt dasselbe unabhaengig von dieser Zeile (0031: team_members_
    // insert/update verlangen fuer role='coach' has_cap(...,'team_coaches',
    // 'manage')) — die API ist hier die erste, nicht die einzige Verteidigung.
    await requireCap(c, clubId, 'team_coaches', 'manage');

    const rows = await withUser(claims, async (tx) => {
      const team = await tx`
        select id from app.teams
        where id = ${teamId} and club_id = ${clubId} and deleted_at is null`;
      if (team.length === 0) {
        throw problem(404, 'Not Found', 'Team nicht gefunden. / Team not found.');
      }

      if (member_ids.length > 0) {
        const valid = await tx`
          select id from app.club_members
          where club_id = ${clubId} and deleted_at is null and id = any(${member_ids}::uuid[])`;
        if (valid.length !== new Set(member_ids).size) {
          throw problem(
            404,
            'Not Found',
            'Mindestens eine Person gehoert nicht zu diesem Verein. / At least one person does not belong to this club.',
          );
        }
      }

      // Der Unique-Index sieht auch soft-geloeschte Zeilen -> ALLE laden.
      const existing = await tx`
        select member_id, role, deleted_at from app.team_members
        where team_id = ${teamId} and club_id = ${clubId}`;
      const byMember = new Map(
        existing.map((r) => [
          r['member_id'] as string,
          { role: r['role'] as string, deleted: r['deleted_at'] !== null },
        ]),
      );

      // Skater-Kollision VOR jedem Schreibvorgang: sonst kippte ein
      // on-conflict-do-update den Skater still aus dem Team-Roster.
      for (const id of member_ids) {
        const row = byMember.get(id);
        if (row && row.role !== 'coach' && !row.deleted) {
          throw problem(
            409,
            'Conflict',
            'Diese Person ist in dem Team bereits Skater:in — eine Person kann pro Team nur eine ' +
              'Rolle haben. Entferne sie zuerst aus dem Roster. / This person is already a skater ' +
              'in this team — one row per person and team. Remove them from the roster first.',
          );
        }
      }

      const want = new Set(member_ids);
      // Entfernen = SOFT-Delete (es gibt keine delete-Policy auf team_members).
      for (const [memberId, row] of byMember) {
        if (row.role === 'coach' && !row.deleted && !want.has(memberId)) {
          await tx`update app.team_members set deleted_at = now()
                   where team_id = ${teamId} and member_id = ${memberId}`;
        }
      }
      for (const memberId of want) {
        const row = byMember.get(memberId);
        if (!row) {
          await tx`insert into app.team_members (club_id, team_id, member_id, role)
                   values (${clubId}, ${teamId}, ${memberId}, 'coach')`;
        } else if (row.deleted || row.role !== 'coach') {
          // Reaktivieren: der Unique-Index filtert deleted_at nicht, ein INSERT
          // liefe auf 23505. (role <> 'coach' ist hier nur noch fuer eine
          // soft-geloeschte Skater-Zeile erreichbar — die Live-Kollision ist
          // oben schon mit 409 abgefangen.)
          await tx`update app.team_members set deleted_at = null, role = 'coach'
                   where team_id = ${teamId} and member_id = ${memberId}`;
        }
      }

      return tx`
        select member_id from app.team_coaches
        where team_id = ${teamId} and club_id = ${clubId}
        order by member_id`;
    });
    return c.json(
      z.array(uuid).parse(rows.map((r) => r['member_id'] as string)),
      200,
    );
  },
);
