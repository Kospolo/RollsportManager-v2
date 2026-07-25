// ============================================================================
// routes/events.ts - events, RSVPs (self / children via guardianship) and
// attendance (coaching staff incl. time-boxed guest_coach).
//
// RSVP/attendance writes run impersonated: the RLS policies
// (can_act_for_member / has_club_role with server-side guest expiry) are the
// final arbiter - a stale guest_coach claim is rejected by the DB even if it
// passes the claim-based guard here (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  attendanceSchema,
  attendanceUpsertSchema,
  deletedSchema,
  eventCreateSchema,
  eventSchema,
  eventUpdateSchema,
  rsvpSchema,
  rsvpUpsertSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, hasClubRole, requireClubMember, requireClubRole } from '../lib/guards.js';
import { requireCap } from '../lib/capabilities.js';
import type { ClubRole } from '../middleware/auth.js';

/**
 * Structure changes (creating events) exclude guest_coach by design.
 *
 * 0050: 'moderator' ERGAENZT — und das schliesst eine API/DB-Divergenz, die
 * aelter ist als dieser Auftrag. Die Policy events_insert erlaubt dem moderator
 * das Anlegen seit 0007:286 (`alter policy ... owner/admin/moderator/coach`);
 * nur diese Liste hier kannte ihn nie. Folge, live gegen :3022 gemessen: der
 * moderator bekam auf POST /events 403, obwohl die Datenbank ihn durchliesse.
 * Damit waere die Bestellung "audience='club' duerfen owner/admin/moderator"
 * fuer den moderator unerfuellbar geblieben — er kaeme nie bis zum Haekchen.
 * KEIN neues Recht: die DB gewaehrt es seit 0007 und bleibt die letzte Instanz;
 * hier faellt nur ein Gate, das strenger war als die Policy dahinter.
 */
const EVENT_WRITE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator', 'coach'];

/**
 * Wer Termine fuer BELIEBIGE Teams anlegen darf. Alle uebrigen aus
 * EVENT_WRITE_ROLES (= coach) sind auf app.coached_team_ids zugeschnitten
 * (Migration 0050): eine Trainerin legt Termine nur fuer die Teams an, die sie
 * betreut - vorher durfte sie es fuer JEDES Team im Verein.
 *
 * DECKUNGSGLEICH mit der Policy event_teams_insert (0050), und die nennt
 * owner/admin/MODERATOR. Faellt der moderator hier heraus, laeuft er in den
 * coach-Zweig, hat keine coached_team_ids und bekommt fuer JEDEN Team-Termin
 * 403 — waehrend die Datenbank ihn durchliesse. Genau so gemessen.
 */
const EVENT_WRITE_ANY_TEAM_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator'];

/**
 * Wer eine VEREINSVERANSTALTUNG (audience='club') setzen darf - der
 * ausdrueckliche Wunsch des Nutzers: "ja verein — darf aber nicht jeder was
 * eintragen". Bewusst OHNE coach, obwohl der sonst Termine anlegen darf.
 * Deckungsgleich mit dem DB-Trigger app.protect_event_audience (0050); zur
 * Frage, warum das keine konfigurierbare Faehigkeit ist, siehe dort.
 */
const CLUB_AUDIENCE_ROLES: readonly ClubRole[] = ['owner', 'admin', 'moderator'];

export const eventsRouter = createRouter();

const eventIdParam = z.object({ eventId: uuid.openapi({ param: { name: 'eventId', in: 'path' } }) });

/**
 * Einen Termin ueber den NORMALEN Lesepfad holen (RLS aktiv), in derselben
 * Form wie GET /events. Genutzt zum Rueckenlesen nach dem Anlegen - siehe den
 * RETURNING-Fallstrick in POST /events.
 */
async function selectEvent(tx: Tx, eventId: string): Promise<unknown | undefined> {
  const rows = await tx`
    select e.*,
      coalesce((select jsonb_agg(et.team_id order by et.created_at)
                from app.event_teams et
                where et.event_id = e.id and et.deleted_at is null),
               '[]'::jsonb) as team_ids,
      coalesce((select jsonb_agg(to_jsonb(r) order by r.responded_at)
                from app.event_rsvps_visible r
                where r.event_id = e.id and r.deleted_at is null),
               '[]'::jsonb) as rsvps
    from app.events e
    where e.id = ${eventId} and e.deleted_at is null`;
  return rows[0];
}

async function loadEvent(
  tx: Tx,
  eventId: string,
): Promise<{ id: string; club_id: string; audience: 'teams' | 'club' }> {
  // audience mitlesen: PATCH/DELETE gaten damit die Vereinsveranstaltung
  // API-seitig (deckungsgleich mit CLUB_AUDIENCE_ROLES / dem Trigger 0050) —
  // die RSVP-/Anwesenheits-Handler ignorieren das Feld schlicht.
  const rows = await tx`
    select id, club_id, audience from app.events
    where id = ${eventId} and deleted_at is null`;
  const event = rows[0];
  if (!event) throw problem(404, 'Not Found', 'Event not found');
  return event as { id: string; club_id: string; audience: 'teams' | 'club' };
}

eventsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/events',
    tags: ['events'],
    summary: 'List events of a club (optionally time-windowed)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(eventSchema), 'Events visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, from, to } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select e.*,
           coalesce((select jsonb_agg(et.team_id order by et.created_at)
                     from app.event_teams et
                     where et.event_id = e.id and et.deleted_at is null),
                    '[]'::jsonb) as team_ids,
           -- app.event_rsvps_visible statt app.event_rsvps (0040): 'sick' und der
           -- Freitext sind Gesundheitsdaten (Art. 9), meist die eines Kindes. Die
           -- View maskiert sie fuer alle ausser der Person selbst, ihren
           -- Erziehungsberechtigten, owner/admin und der Trainer:in ihres Teams.
           -- Die ZEILEN filtert unveraendert die RLS. Die Rohspalten sind
           -- authenticated ohnehin entzogen — ein to_jsonb(r) auf die Basistabelle
           -- scheitert ab 0040 mit 42501 statt still zu lecken.
           coalesce((select jsonb_agg(to_jsonb(r) order by r.responded_at)
                     from app.event_rsvps_visible r
                     where r.event_id = e.id and r.deleted_at is null),
                    '[]'::jsonb) as rsvps
         from app.events e
         where e.club_id = ${club_id} and e.deleted_at is null
           and (${from ?? null}::timestamptz is null or e.starts_at >= ${from ?? null})
           and (${to ?? null}::timestamptz is null or e.starts_at <= ${to ?? null})
         order by e.starts_at`,
    );
    return c.json(z.array(eventSchema).parse(rows), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/events',
    tags: ['events'],
    summary: 'Create an event (owner/admin/coach) with optional team links',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: eventCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(eventSchema, 'Created event'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, EVENT_WRITE_ROLES);

    // "ja verein — darf aber nicht jeder was eintragen": das Haekchen
    // 'Vereinsveranstaltung' ist rechtepflichtig. ERSTE Linie; die zweite ist
    // der Trigger app.protect_event_audience (0050), der auch dann greift, wenn
    // dieser Gate jemals umgangen oder vergessen wird. v1 hatte genau diese
    // Pruefung NUR im Client - das war der Fehler dieses Projekts.
    if (body.audience === 'club') {
      requireClubRole(claims, body.club_id, CLUB_AUDIENCE_ROLES);
    }

    const created = await withUser(claims, async (tx) => {
      // Eine Trainerin haengt Termine nur an IHRE Teams. Die Wahrheit dazu ist
      // app.coached_team_ids - dieselbe Funktion, an der auch die Policy
      // event_teams_insert (0050) haengt; kein zweites Regelwerk in TS. Die
      // Policy wuerde ohnehin greifen (42501 -> 403), aber erst NACH dem
      // events-Insert: ohne diesen Gate bliebe ein Termin OHNE Team zurueck,
      // sobald der Insert der Zuordnung scheitert. Deshalb vorher fragen.
      if (
        body.team_ids.length > 0 &&
        !hasClubRole(claims, body.club_id, EVENT_WRITE_ANY_TEAM_ROLES)
      ) {
        const coachedRows = await tx`select app.coached_team_ids(${body.club_id}) as ids`;
        const coached = new Set((coachedRows[0] as { ids: string[] }).ids ?? []);
        const foreign = body.team_ids.filter((id) => !coached.has(id));
        if (foreign.length > 0) {
          throw problem(
            403,
            'Forbidden',
            `Termine nur fuer eigene Teams: ${foreign.join(', ')} wird von dir nicht betreut`,
          );
        }
      }

      // ---------------------------------------------------------------------
      // KEIN `returning` — derselbe Fallstrick wie bei den Kueren (routines.ts:
      // 128-145, Test 93f). `insert ... returning` zieht ZUSAETZLICH die
      // SELECT-Policy heran. events_select haengt seit 0050 an
      // app.can_read_event(id); die Funktion ist STABLE und liest app.events,
      // sieht die eben eingefuegte Zeile im Snapshot des EIGENEN Statements
      // also nicht -> false -> Postgres meldet das irrefuehrende "new row
      // violates row-level security policy for table events" (42501), OBWOHL
      // der INSERT selbst erlaubt ist. Live gegen die Harness belegt: ohne
      // returning OK, mit `returning id` 42501 — sogar als owner.
      // ACHTUNG: `returning id` genuegt NICHT als Ausweg, JEDES returning
      // loest die SELECT-Policy aus.
      //
      // Der Weg (identisch zu routines.ts): id vorab ziehen (app.uuid_v7()
      // erhaelt die Zeitordnung des Spalten-Defaults), OHNE returning
      // einfuegen, die Team-Zuordnung schreiben und die Zeile DANACH in einem
      // SEPARATEN Statement zurueckenlesen. Ein spaeteres Statement derselben
      // Transaktion sieht die frueheren Schreibvorgaenge — und erst dann
      // existieren die event_teams-Zeilen, an denen can_read_event haengt.
      // Die SELECT-Policy bleibt unangetastet (keine Aufweichung).
      // ---------------------------------------------------------------------
      const idRows = await tx`select app.uuid_v7() as id`;
      const eventId = (idRows[0] as { id: string }).id;

      await tx`
        insert into app.events (id, club_id, type, title, note, location, starts_at, ends_at, audience)
        values (${eventId}, ${body.club_id}, ${body.type}, ${body.title}, ${body.note ?? null},
                ${body.location ?? null}, ${body.starts_at}, ${body.ends_at}, ${body.audience})`;
      for (const teamId of body.team_ids) {
        await tx`
          insert into app.event_teams (club_id, event_id, team_id)
          values (${body.club_id}, ${eventId}, ${teamId})`;
      }

      // Rueckenlesen ueber den NORMALEN Lesepfad (RLS aktiv). Liefert er
      // nichts, hat der Aufrufer einen Termin angelegt, den er selbst nicht
      // sehen darf. Das ist kein theoretischer Fall: das Schreibrecht
      // (owner/admin/coach) ist WEITER als das Leserecht (can_read_event) —
      // eine Trainerin, die einen Termin OHNE Team anlegt, erzeugt genau so
      // eine Zeile (Grenzfall A: nur der Vorstand saehe sie). Statt eine
      // unsichtbare Geisterzeile zu hinterlassen, bricht die Transaktion ab.
      const row = await selectEvent(tx, eventId);
      if (row === undefined) {
        throw problem(
          422,
          'Unprocessable Entity',
          'You may only create an event you can also see: assign at least one team you coach, or mark it as a club-wide event.',
        );
      }
      return row;
    });
    return c.json(eventSchema.parse(created), 201);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/events/{eventId}',
    tags: ['events'],
    summary: 'Edit an event (owner/admin/coach); team links only for coached teams',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: eventUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(eventSchema, 'Updated event'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      // Normaler Lesepfad (RLS aktiv): 404, wenn unsichtbar/nicht vorhanden.
      const event = await loadEvent(tx, eventId);

      // Gating DECKUNGSGLEICH mit POST /events: dieselben EVENT_WRITE_ROLES.
      requireClubRole(claims, event.club_id, EVENT_WRITE_ROLES);

      // "ja verein — darf aber nicht jeder was eintragen": eine
      // Vereinsveranstaltung anzulegen ODER daraus/dazu umzustufen bleibt
      // rechtepflichtig. new.audience='club' faengt der API-Gate hier ab
      // (wie in POST), old.audience='club' der Trigger app.protect_event_audience
      // (0050, 42501 -> 403). Beide Wege sitzen auf CLUB_AUDIENCE_ROLES.
      if (body.audience === 'club' || event.audience === 'club') {
        requireClubRole(claims, event.club_id, CLUB_AUDIENCE_ROLES);
      }

      // Eine Trainerin haengt Termine nur an IHRE Teams — dieselbe Pruefung wie
      // in POST /events (app.coached_team_ids / Policy event_teams_insert, 0050).
      if (
        body.team_ids !== undefined &&
        body.team_ids.length > 0 &&
        !hasClubRole(claims, event.club_id, EVENT_WRITE_ANY_TEAM_ROLES)
      ) {
        const coachedRows = await tx`select app.coached_team_ids(${event.club_id}) as ids`;
        const coached = new Set((coachedRows[0] as { ids: string[] }).ids ?? []);
        const foreign = body.team_ids.filter((id) => !coached.has(id));
        if (foreign.length > 0) {
          throw problem(
            403,
            'Forbidden',
            `Termine nur fuer eigene Teams: ${foreign.join(', ')} wird von dir nicht betreut`,
          );
        }
      }

      // Team-Zuordnung als VOLL-Replace, wenn team_ids mitkommt. Das ENTFERNEN
      // laeuft VOR dem Skalar-Update: sonst schlaegt ein Wechsel auf
      // audience='club' am AFTER-Trigger events_audience_no_teams fehl (23514),
      // solange noch aktive Team-Zeilen existieren. Das HINZUFUEGEN laeuft
      // DANACH (audience steht dann auf 'teams').
      let toAdd: string[] = [];
      if (body.team_ids !== undefined) {
        const desired = new Set(body.team_ids);
        const activeRows = await tx`
          select team_id from app.event_teams
          where event_id = ${eventId} and deleted_at is null`;
        const active = new Set<string>();
        for (const r of activeRows) active.add((r as { team_id: string }).team_id);
        for (const teamId of active) {
          if (!desired.has(teamId)) {
            await tx`
              update app.event_teams set deleted_at = now()
              where event_id = ${eventId} and team_id = ${teamId} and deleted_at is null`;
          }
        }
        toAdd = body.team_ids.filter((id) => !active.has(id));
      }

      // Skalar-Felder OHNE team_ids (das ist die n:m-Tabelle, kein Spaltenwert).
      // KEIN `returning` — derselbe RETURNING-Fallstrick wie in POST /events:
      // events_select haengt seit 0050 an app.can_read_event. Das Ergebnis wird
      // unten in einem SEPARATEN Statement (selectEvent) zurueckgelesen.
      const scalar: Record<string, unknown> = {};
      if (body.type !== undefined) scalar.type = body.type;
      if (body.title !== undefined) scalar.title = body.title;
      if (body.note !== undefined) scalar.note = body.note;
      if (body.location !== undefined) scalar.location = body.location;
      if (body.starts_at !== undefined) scalar.starts_at = body.starts_at;
      if (body.ends_at !== undefined) scalar.ends_at = body.ends_at;
      if (body.audience !== undefined) scalar.audience = body.audience;
      if (Object.keys(scalar).length > 0) {
        await tx`update app.events set ${tx(scalar)} where id = ${eventId} and deleted_at is null`;
      }

      // Hinzufuegen/Reaktivieren per upsert: event_teams_uq (event_id, team_id)
      // ist NICHT partiell auf deleted_at — ein erneutes plain INSERT einer
      // frueher entfernten Zuordnung liefe in die Unique-Kollision.
      for (const teamId of toAdd) {
        await tx`
          insert into app.event_teams (club_id, event_id, team_id)
          values (${event.club_id}, ${eventId}, ${teamId})
          on conflict (event_id, team_id) do update
            set deleted_at = null, updated_at = now()`;
      }

      // Rueckenlesen ueber den NORMALEN Lesepfad (RLS aktiv) — wie in POST.
      // Liefert er nichts, hat der Aufrufer den Termin so veraendert, dass er ihn
      // selbst nicht mehr sehen darf; statt eine unsichtbare Zeile zu
      // hinterlassen, bricht die Transaktion ab.
      const row = await selectEvent(tx, eventId);
      if (row === undefined) {
        throw problem(
          422,
          'Unprocessable Entity',
          'You may only edit an event you can also see: keep at least one team you coach, or mark it as a club-wide event.',
        );
      }
      return row;
    });
    return c.json(eventSchema.parse(updated), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/events/{eventId}',
    tags: ['events'],
    summary: 'Soft-delete an event (owner/admin/coach; club-wide events only by the board)',
    security: [{ bearerAuth: [] }],
    request: { params: eventIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Event soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const event = await loadEvent(tx, eventId); // 404 when invisible (RLS)
      requireClubRole(claims, event.club_id, EVENT_WRITE_ROLES);
      // Eine Vereinsveranstaltung entfernt nur der Vorstand — API-Gate wie in
      // POST, zweite Linie ist der Trigger app.protect_event_audience (0050),
      // der beim UPDATE mit old.audience='club' owner/admin/moderator verlangt.
      if (event.audience === 'club') {
        requireClubRole(claims, event.club_id, CLUB_AUDIENCE_ROLES);
      }
      // Soft-delete = UPDATE ... set deleted_at (events kennen keinen eigenen
      // DELETE-Pfad; das PowerSync-Tombstone ist die deleted_at-Spalte, 0003).
      // KEIN `returning`: der RETURNING-Fallstrick (events_select ->
      // can_read_event, das deleted_at is null filtert) wuerde auf der eben
      // getilgten Zeile ein irrefuehrendes 0-rows liefern. Die Autorisierung
      // steht bereits (requireClubRole == events_update-Policy owner/admin/
      // moderator/coach), die Existenz hat loadEvent belegt.
      await tx`
        update app.events set deleted_at = now()
        where id = ${eventId} and deleted_at is null`;
    });
    return c.json({ status: 'deleted' as const, id: eventId }, 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/events/{eventId}/rsvp',
    tags: ['events'],
    summary: 'Set an RSVP for the own membership or an own child (guardianship)',
    description:
      'Upsert on (event, member). RLS enforces can_act_for_member: own row or own child - coaches may answer for anyone in the club.',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: rsvpUpsertSchema } }, required: true },
    },
    responses: {
      200: jsonContent(rsvpSchema, 'Stored RSVP'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const stored = await withUser(claims, async (tx) => {
      const event = await loadEvent(tx, eventId); // 404 when invisible (RLS)
      requireClubMember(claims, event.club_id);
      // 0040: authenticated hat auf status/comment KEIN SELECT mehr (Art.-9-Riegel).
      // Zwei Folgen fuer diesen Upsert, beide gemessen:
      //   * `set status = excluded.status` scheitert mit 42501 — ON CONFLICT DO
      //     UPDATE verlangt SELECT auf die Spalten, die es in seinen SET-
      //     Ausdruecken liest. Deshalb steht dort jetzt der Parameter selbst;
      //     wertgleich (excluded.status IST dieser Wert), und der Upsert bleibt
      //     EIN atomares Statement.
      //   * `returning *` scheitert ebenso -> `returning id`, danach wird die
      //     Zeile aus app.event_rsvps_visible gelesen. Die schreibende Person ist
      //     per RLS immer self/guardian/coach, sieht ihre eigene Eingabe also
      //     unmaskiert zurueck; nur eine Trainerin, die fuer ein Kind AUSSERHALB
      //     ihrer Teams antwortet, bekommt den maskierten Wert — sie darf ihn
      //     nicht behalten, und sie hat ihn selbst gerade geschickt.
      const written = await tx`
        insert into app.event_rsvps (club_id, event_id, member_id, status, comment, responded_at)
        values (${event.club_id}, ${eventId}, ${body.member_id}, ${body.status},
                ${body.comment ?? null}, now())
        on conflict (event_id, member_id) do update
          set status = ${body.status},
              comment = ${body.comment ?? null},
              responded_at = now(),
              deleted_at = null
        returning id`;
      const rows = await tx`
        select * from app.event_rsvps_visible where id = ${(written[0] as { id: string }).id}`;
      return rows[0];
    });
    return c.json(rsvpSchema.parse(stored), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/attendance',
    tags: ['events'],
    summary: 'List attendance records of a club (optionally for one event)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        event_id: uuid.optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(attendanceSchema), 'Attendance records visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, event_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.attendance
         where club_id = ${club_id} and deleted_at is null
           and (${event_id ?? null}::uuid is null or event_id = ${event_id ?? null})
         order by created_at`,
    );
    return c.json(z.array(attendanceSchema).parse(rows), 200);
  },
);

eventsRouter.openapi(
  createRoute({
    method: 'put',
    path: '/events/{eventId}/attendance',
    tags: ['events'],
    summary: 'Record attendance for a member (coach and above, incl. guest_coach)',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventIdParam,
      body: { content: { 'application/json': { schema: attendanceUpsertSchema } }, required: true },
    },
    responses: {
      200: jsonContent(attendanceSchema, 'Stored attendance record'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const stored = await withUser(claims, async (tx) => {
      const event = await loadEvent(tx, eventId);
      // Phase 2: aus der DATENBANK aufgeloest statt aus dem Claim.
      // ALT: hasClubRole(claims, ..., COACH_ROLES) — las die EINE Rolle aus dem
      // Token; wer per Admin-UI eine Zweitrolle 'coach' bekam, blieb draussen,
      // obwohl die DB (attendance_insert = has_cap(...,'attendance','edit'),
      // 0026:162) laengst ja sagte. Genau diese Luecke schliesst der Tausch.
      // attendance >= edit ist im Seed exakt COACH_ROLES -> Rollenmenge
      // unveraendert, deckungsgleich mit der Policy.
      await requireCap(c, event.club_id, 'attendance', 'edit');
      const checkedInAt =
        body.checked_in_at ?? (body.status === 'present' || body.status === 'late' ? new Date().toISOString() : null);
      const rows = await tx`
        insert into app.attendance (club_id, event_id, member_id, status, checked_in_at)
        values (${event.club_id}, ${eventId}, ${body.member_id}, ${body.status}, ${checkedInAt})
        on conflict (event_id, member_id) do update
          set status = excluded.status,
              checked_in_at = excluded.checked_in_at,
              deleted_at = null
        returning *`;
      return rows[0];
    });
    return c.json(attendanceSchema.parse(stored), 200);
  },
);
