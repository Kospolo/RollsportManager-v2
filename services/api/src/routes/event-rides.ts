// ============================================================================
// routes/event-rides.ts — Fahrgemeinschaften zu Terminen (Migration 0066).
//
// Fuenf Endpunkte: Fahrten eines Termins lesen, Fahrt anbieten, Fahrt
// bearbeiten/absagen, als Mitfahrer zusagen (fuer sich oder das eigene Kind),
// Zusage zurueckziehen.
//
// ### DIE KONTAKT-SICHTBARKEIT WIRD HIER NICHT ENTSCHIEDEN ###
// Das ist der wichtigste Satz dieser Datei. Die Rueckrufnummer steht in
// app.event_ride_contacts — einer eigenen Tabelle mit einer engeren
// SELECT-Policy als die Fahrt selbst (0066 begruendet ausfuehrlich, warum eine
// Spalte auf app.event_rides das NICHT leisten koennte: RLS schuetzt Zeilen,
// nicht Spalten). Alle Abfragen hier laufen ueber withUser, also unter der
// Identitaet der/des Aufrufenden und mit vollem RLS. Der LEFT JOIN auf
// event_ride_contacts liefert deshalb von selbst NULL, wenn die Person nicht
// beteiligt ist.
//
// Konsequenz: es gibt in dieser Datei KEINE redact-Funktion, die man vergessen
// koennte, und keinen if-Zweig, den ein spaeterer Umbau falsch abbiegen laesst.
// Wer die Nummer nicht sehen darf, bekommt sie nicht — auch dann nicht, wenn
// dieser Code sie arglos mitselektiert. Das ist der Unterschied zu einer reinen
// API-Projektion (0054/members.ts), und er ist hier Absicht: in der Nummer
// steckt ein Elternkontakt, und das Publikum der Fahrt ist der halbe Verein.
//
// kontakt_sichtbar (= app.may_see_ride_contact) wird MITGELIEFERT, damit die UI
// "keine Nummer hinterlegt" von "nicht fuer dich" unterscheiden kann, ohne die
// Regel selbst zu kennen.
//
// ### RETURNING-FALLE ###
// event_ride_contacts hat eine restriktive SELECT-Policy -> INSERT ... RETURNING
// dort kann in 42501 laufen. Alle Schreiber folgen deshalb dem Repo-Muster:
// app.uuid_v7() vorab besorgen, INSERT OHNE RETURNING, danach getrennt lesen.
//
// ### UEBERBUCHUNG ###
// Verhindert der Trigger app.enforce_ride_capacity (0066), nicht diese Datei —
// er sperrt die Fahrt-Zeile und kann deshalb auch zwei gleichzeitige Zusagen
// nicht beide durchlassen. Seine Meldung ist deutscher Klartext und wird von
// middleware/error.ts (23514 -> 422) woertlich an den Client durchgereicht.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  eventRideCreateSchema,
  eventRideRiderCreateSchema,
  eventRideRiderUpdateSchema,
  eventRideSchema,
  eventRideUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMemberDb } from '../lib/capabilities.js';
import { ownMemberId } from '../lib/ownership.js';

export const eventRidesRouter = createRouter();

const eventParams = z.object({ eventId: uuid.openapi({ param: { name: 'eventId', in: 'path' } }) });
const rideParams = z.object({ rideId: uuid.openapi({ param: { name: 'rideId', in: 'path' } }) });
const riderParams = z.object({
  rideId: uuid.openapi({ param: { name: 'rideId', in: 'path' } }),
  riderId: uuid.openapi({ param: { name: 'riderId', in: 'path' } }),
});

/**
 * Die Fahrt-Projektion. EINE Stelle, an der die Form entsteht — jede Antwort
 * dieser Datei geht durch sie, damit "anbieten" und "lesen" nicht auseinander
 * driften koennen.
 *
 * rueckrufnummer kommt aus dem LEFT JOIN (RLS-gefiltert, siehe Dateikopf);
 * kontakt_sichtbar sagt, ob NULL "gesperrt" oder "nicht hinterlegt" bedeutet.
 */
const RIDE_SELECT = `
  select r.id, r.club_id, r.event_id, r.driver_member_id,
         dm.first_name as driver_first_name,
         dm.last_name  as driver_last_name,
         r.abfahrtsort, r.abfahrtszeit, r.plaetze_gesamt, r.notiz, r.status,
         r.created_at, r.updated_at,
         c.rueckrufnummer,
         app.may_see_ride_contact(r.id) as kontakt_sichtbar,
         greatest(
           r.plaetze_gesamt - (
             select count(*) from app.event_ride_riders rr
             where rr.ride_id = r.id and rr.status = 'zugesagt' and rr.deleted_at is null
           ), 0)::int as plaetze_frei,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', rr.id,
                    'ride_id', rr.ride_id,
                    'member_id', rr.member_id,
                    'member_first_name', rm.first_name,
                    'member_last_name', rm.last_name,
                    'angemeldet_von_profile_id', rr.angemeldet_von_profile_id,
                    'status', rr.status,
                    'created_at', rr.created_at,
                    'updated_at', rr.updated_at)
                  order by rr.created_at)
           from app.event_ride_riders rr
           join app.club_members rm on rm.id = rr.member_id
           where rr.ride_id = r.id and rr.status = 'zugesagt' and rr.deleted_at is null
         ), '[]'::jsonb) as riders
  from app.event_rides r
  join app.club_members dm on dm.id = r.driver_member_id
  left join app.event_ride_contacts c on c.ride_id = r.id
`;

/** Eine Fahrt re-lesen, oder 404 wenn unsichtbar/abwesend. */
async function readRide(tx: Tx, rideId: string): Promise<unknown> {
  const rows = await tx.unsafe(`${RIDE_SELECT} where r.id = $1 and r.deleted_at is null`, [rideId]);
  if (rows.length === 0) throw problem(404, 'Not Found', 'Fahrt nicht gefunden');
  return rows[0];
}

/**
 * club_id + event_id einer Fahrt bestimmen — unter RLS, also nur wenn die
 * Person die Fahrt ueberhaupt sehen darf. Alle Schreib-Endpunkte haengen daran:
 * eine unsichtbare Fahrt ist eine 404, kein 403 (sie soll nicht einmal ihre
 * Existenz verraten).
 */
async function loadRideRef(tx: Tx, rideId: string): Promise<{ club_id: string }> {
  const rows = await tx`
    select club_id from app.event_rides
    where id = ${rideId} and deleted_at is null`;
  const ride = rows[0];
  if (!ride) throw problem(404, 'Not Found', 'Fahrt nicht gefunden');
  return ride as { club_id: string };
}

/** club_id eines Termins, unter RLS (unsichtbarer Termin -> 404). */
async function loadEventRef(tx: Tx, eventId: string): Promise<{ club_id: string }> {
  const rows = await tx`
    select club_id from app.events
    where id = ${eventId} and deleted_at is null`;
  const event = rows[0];
  if (!event) throw problem(404, 'Not Found', 'Termin nicht gefunden');
  return event as { club_id: string };
}

// ---------------------------------------------------------------------------
// LIST — die Fahrten eines Termins.
//
// Kein eigener Sichtbarkeits-Zweig: die RLS-Policy event_rides_select ruft
// app.can_read_event auf, also gilt exakt die Termin-Sichtbarkeit. Wer den
// Termin nicht sieht, sieht hier nichts — und muss dafuer nichts wissen.
// ---------------------------------------------------------------------------
eventRidesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/events/{eventId}/rides',
    tags: ['event-rides'],
    summary: 'Fahrgemeinschaften eines Termins (Sichtbarkeit = Termin-Sichtbarkeit)',
    security: [{ bearerAuth: [] }],
    request: { params: eventParams },
    responses: {
      200: jsonContent(z.array(eventRideSchema), 'Fahrten, die der/die Aufrufende sehen darf'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const rows = await withUser(c.get('claims'), async (tx) => {
      const event = await loadEventRef(tx, eventId);
      await requireClubMemberDb(c, event.club_id);
      return tx.unsafe(
        `${RIDE_SELECT} where r.event_id = $1 and r.deleted_at is null order by r.abfahrtszeit, r.created_at`,
        [eventId],
      );
    });
    return c.json(z.array(eventRideSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// CREATE — eine Fahrt anbieten.
//
// Der Fahrer ist per Vorgabe die eigene Mitgliedschaft. Ein abweichender
// driver_member_id ist erlaubt, aber die RLS-Policy laesst ihn nur dem Vorstand
// durch (Telefon-Anmeldung: "ich fahre, trag mich ein").
//
// MINDERJAEHRIGE weist der Trigger app.protect_ride_driver_adult ab (42501 ->
// 403). Diese Datei prueft das Alter NICHT selbst nach: eine zweite Alterslogik
// im Client-Pfad koennte von der DB abweichen, und die DB ist die, die haelt.
// ---------------------------------------------------------------------------
eventRidesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/events/{eventId}/rides',
    tags: ['event-rides'],
    summary: 'Fahrt anbieten (aktives Mitglied, nicht minderjaehrig)',
    security: [{ bearerAuth: [] }],
    request: {
      params: eventParams,
      body: { content: { 'application/json': { schema: eventRideCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(eventRideSchema, 'Angebotene Fahrt'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const ride = await withUser(claims, async (tx) => {
      const event = await loadEventRef(tx, eventId);
      await requireClubMemberDb(c, event.club_id);

      const driverId = body.driver_member_id ?? (await ownMemberId(tx, claims, event.club_id));
      if (!driverId) {
        throw problem(403, 'Forbidden', 'Nur aktive Mitglieder koennen eine Fahrt anbieten');
      }

      // Vorbelegung der Rueckrufnummer aus der hinterlegten Telefonnummer des
      // Fahrers — ueberschreibbar (der Auftrag). Ausdruecklich SERVERSEITIG
      // gelesen: der Client soll fremde Telefonnummern weder kennen noch
      // vorschlagen muessen.
      let nummer = body.rueckrufnummer ?? null;
      if (nummer === null) {
        const rows = await tx`
          select phone from app.club_members where id = ${driverId} and deleted_at is null`;
        nummer = (rows[0]?.['phone'] as string | null | undefined) ?? null;
      }

      // uuid_v7 vorab + INSERT OHNE RETURNING (RETURNING-Falle, siehe Kopf).
      const [{ id: rideId }] = (await tx`select app.uuid_v7() as id`) as unknown as [{ id: string }];

      await tx`
        insert into app.event_rides
          (id, club_id, event_id, driver_member_id, abfahrtsort, abfahrtszeit, plaetze_gesamt, notiz)
        values (${rideId}, ${event.club_id}, ${eventId}, ${driverId},
                ${body.abfahrtsort}, ${body.abfahrtszeit}, ${body.plaetze_gesamt},
                ${body.notiz ?? null})`;

      if (nummer !== null && nummer.trim() !== '') {
        await tx`
          insert into app.event_ride_contacts (ride_id, club_id, rueckrufnummer)
          values (${rideId}, ${event.club_id}, ${nummer})`;
      }

      return readRide(tx, rideId);
    });

    return c.json(eventRideSchema.parse(ride), 201);
  },
);

// ---------------------------------------------------------------------------
// UPDATE — Fahrt bearbeiten oder absagen (Fahrer selbst / Vorstand, per RLS).
//
// status: nur 'abgesagt' und 'offen' sind erlaubte EINGABEN. 'voll' ist
// abgeleitet — wer 'offen' setzt, bekommt deshalb den ABGELEITETEN Wert, nicht
// den gewuenschten: sonst stuende an einer ausgebuchten Fahrt wieder 'offen'
// und die Anzeige loege. Dieselbe Regel wie im Trigger, damit es genau eine
// Wahrheit gibt.
// ---------------------------------------------------------------------------
eventRidesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/rides/{rideId}',
    tags: ['event-rides'],
    summary: 'Fahrt bearbeiten oder absagen (Fahrer:in oder Vorstand)',
    security: [{ bearerAuth: [] }],
    request: {
      params: rideParams,
      body: { content: { 'application/json': { schema: eventRideUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(eventRideSchema, 'Aktualisierte Fahrt'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { rideId } = c.req.valid('param');
    const body = c.req.valid('json');

    const ride = await withUser(c.get('claims'), async (tx) => {
      const ref = await loadRideRef(tx, rideId);
      await requireClubMemberDb(c, ref.club_id);

      const { rueckrufnummer, status, ...rest } = body;

      if (Object.keys(rest).length > 0) {
        const updated = await tx`
          update app.event_rides set ${tx(rest)}
          where id = ${rideId} and deleted_at is null
          returning id`;
        if (updated.length === 0) {
          throw problem(403, 'Forbidden', 'Diese Fahrt darfst du nicht bearbeiten');
        }
      }

      if (status !== undefined) {
        // 'abgesagt' woertlich; 'offen' als ABGELEITETER Wert (siehe oben).
        const updated = await tx`
          update app.event_rides r
             set status = case
                            when ${status} = 'abgesagt' then 'abgesagt'::app.event_ride_status
                            when (select count(*) from app.event_ride_riders rr
                                  where rr.ride_id = r.id
                                    and rr.status = 'zugesagt'
                                    and rr.deleted_at is null) >= r.plaetze_gesamt
                              then 'voll'::app.event_ride_status
                            else 'offen'::app.event_ride_status
                          end
           where r.id = ${rideId} and r.deleted_at is null
           returning r.id`;
        if (updated.length === 0) {
          throw problem(403, 'Forbidden', 'Diese Fahrt darfst du nicht bearbeiten');
        }
      }

      if (rueckrufnummer !== undefined) {
        // Wer die Nummer anfassen darf, wird EINMAL und ausdruecklich gefragt —
        // nicht aus dem Ausgang einer Schreiboperation erraten. Grund (0067):
        // ein DELETE, das die RLS nicht durchlaesst, wirft keinen Fehler,
        // sondern trifft NULL Zeilen. Ohne diese Frage haette die Route den
        // Widerruf einer Kontaktnummer weiterhin mit 200 quittiert, ohne dass
        // die Nummer verschwunden waere — vorgetaeuschter Widerruf ist bei
        // Kontaktdaten schlimmer als eine ehrliche 403.
        const [gate] = (await tx`
          select exists (
            select 1 from app.event_rides r
            where r.id = ${rideId}
              and r.deleted_at is null
              and (
                exists (select 1 from app.club_members m
                        where m.id = r.driver_member_id
                          and m.profile_id = ${c.get('claims').sub}
                          and m.deleted_at is null)
                or app.has_club_role(r.club_id, array['owner', 'admin', 'moderator'])
              )
          ) as darf`) as unknown as [{ darf: boolean }];
        if (!gate?.darf) {
          throw problem(403, 'Forbidden', 'Die Rueckrufnummer dieser Fahrt darfst du nicht aendern');
        }

        if (rueckrufnummer === null) {
          // Nummer entfernen. Kein Soft-Delete: eine zurueckgezogene
          // Kontaktnummer soll wirklich weg sein (Art. 5 Abs. 1 lit. c/e,
          // Art. 17 DSGVO) — getragen von der DELETE-Policy aus 0067.
          await tx`delete from app.event_ride_contacts where ride_id = ${rideId}`;
          // Gegenprobe statt Vertrauen: die Zeile MUSS weg sein. Steht sie noch
          // da, ist das ein Bruch der Zusicherung und keine 200 wert.
          const rest = await tx`
            select 1 from app.event_ride_contacts where ride_id = ${rideId}`;
          if (rest.length > 0) {
            throw problem(
              500,
              'Internal Server Error',
              'Die Rueckrufnummer konnte nicht entfernt werden',
            );
          }
        } else {
          await tx`
            insert into app.event_ride_contacts (ride_id, club_id, rueckrufnummer)
            values (${rideId}, ${ref.club_id}, ${rueckrufnummer})
            on conflict (ride_id) do update set rueckrufnummer = excluded.rueckrufnummer`;
        }
      }

      return readRide(tx, rideId);
    });

    return c.json(eventRideSchema.parse(ride), 200);
  },
);

// ---------------------------------------------------------------------------
// JOIN — als Mitfahrer zusagen, fuer sich selbst ODER das eigene Kind.
//
// Die Vormund-Logik steckt in der RLS-Policy (app.can_act_for_member) — genau
// die Funktion, die auch die RSVPs benutzen. Hier wird sie NICHT nachgebaut;
// ein fremdes Kind endet als 42501 -> 403.
//
// angemeldet_von_profile_id ist IMMER die verifizierte claims.sub, nie ein
// Feld aus dem Rumpf: sonst koennte eine Zusage behaupten, jemand anderes habe
// sie erklaert. Die Policy erzwingt dasselbe noch einmal.
// ---------------------------------------------------------------------------
eventRidesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/rides/{rideId}/riders',
    tags: ['event-rides'],
    summary: 'Als Mitfahrer:in zusagen (fuer sich selbst oder das eigene Kind)',
    security: [{ bearerAuth: [] }],
    request: {
      params: rideParams,
      body: {
        content: { 'application/json': { schema: eventRideRiderCreateSchema } },
        required: true,
      },
    },
    responses: {
      201: jsonContent(eventRideSchema, 'Fahrt inkl. der neuen Zusage'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { rideId } = c.req.valid('param');
    const { member_id } = c.req.valid('json');
    const claims = c.get('claims');

    const ride = await withUser(claims, async (tx) => {
      const ref = await loadRideRef(tx, rideId);
      await requireClubMemberDb(c, ref.club_id);

      // Eine fruehere Absage wird WIEDERBELEBT statt verdoppelt — das Paar
      // (Fahrt, Mitfahrer) ist eindeutig (event_ride_riders_uq). Ohne diesen
      // Zweig endete jede zweite Zusage in einer 23505/409, obwohl sie voellig
      // in Ordnung ist ("doch wieder mitfahren").
      //
      // ### DIESER ZWEIG IST KEINE ABKUERZUNG (0067) ###
      // Er lief frueher gegen die UPDATE-Policy statt gegen die enge
      // INSERT-Policy — und die UPDATE-Policy liess die FAHRER:IN alles. Damit
      // konnte eine fremde Erwachsene eine vom Vormund abgesagte Zusage eines
      // KINDES eigenmaechtig reaktivieren, sobald die Zeile einmal existierte.
      // Eine Absage war so kein Schutz, sondern ein Tueroeffner.
      //
      // Fachlich ist eine Wiederbelebung eine NEUE Zusage. Sie wird deshalb hier
      // wie eine geprueft — dieselbe Frage, die die INSERT-Policy stellt — und
      // in der DB noch einmal (Policy nach Zielzustand + Trigger
      // app.protect_ride_rider_change). Der ehrliche 403 entsteht damit an der
      // Route UND haelt in der Datenbank; die Route ist die Erklaerung, nicht
      // die Verteidigung.
      const existing = await tx`
        select id from app.event_ride_riders
        where ride_id = ${rideId} and member_id = ${member_id}`;

      if (existing.length > 0) {
        const [gate] = (await tx`
          select (
            app.can_act_for_member(${member_id}::uuid)
            or app.has_club_role(${ref.club_id}::uuid, array['owner', 'admin', 'moderator'])
          ) as darf`) as unknown as [{ darf: boolean }];
        if (!gate?.darf) {
          throw problem(
            403,
            'Forbidden',
            'Fuer diese Person darfst du nicht zusagen — das kann nur sie selbst oder ihr:e Erziehungsberechtigte:r',
          );
        }

        // angemeldet_von_profile_id wird NICHT ueberschrieben: es ist der
        // Nachweis, wer die Zusage urspruenglich erklaert hat, und seit 0067
        // unveraenderlich. Ein Nachweis, den der Nachgewiesene selbst
        // umschreiben kann, ist keiner.
        const updated = await tx`
          update app.event_ride_riders
             set status = 'zugesagt',
                 deleted_at = null
           where id = ${existing[0]?.['id'] as string}
           returning id`;
        if (updated.length === 0) {
          throw problem(403, 'Forbidden', 'Diese Zusage darfst du nicht aendern');
        }
      } else {
        const [{ id: riderId }] = (await tx`select app.uuid_v7() as id`) as unknown as [
          { id: string },
        ];
        await tx`
          insert into app.event_ride_riders
            (id, club_id, ride_id, member_id, angemeldet_von_profile_id)
          values (${riderId}, ${ref.club_id}, ${rideId}, ${member_id}, ${claims.sub})`;
      }

      return readRide(tx, rideId);
    });

    return c.json(eventRideSchema.parse(ride), 201);
  },
);

// ---------------------------------------------------------------------------
// LEAVE — Zusage zurueckziehen (oder erneuern).
//
// Erlaubt sind: die eigene Zusage bzw. die des eigenen Kindes, die FAHRERIN
// dieser Fahrt (sie muss jemanden austragen koennen, wenn das Auto ausfaellt)
// und der Vorstand. Alles davon steht in der Policy event_ride_riders_update —
// hier steht kein zweites Regelwerk.
//
// ABER (0067): das Recht der Fahrerin endet beim AUSTRAGEN. Auf 'zugesagt'
// zuruecksetzen darf nur, wer app.can_act_for_member(member_id) erfuellt (oder
// die Verwaltung) — sonst koennte sie eine vom Vormund abgesagte Zusage eines
// fremden Kindes ueber diesen Endpunkt genauso reaktivieren wie ueber POST
// /riders. Die Policy trennt das nach ZIELZUSTAND, der Trigger
// app.protect_ride_rider_change erkennt den Uebergang; beides endet als
// 42501 -> 403.
//
// Kein DELETE: eine zurueckgezogene Zusage ist 'abgesagt', nicht verschwunden.
// Die Fahrerin soll sehen, dass jemand abgesprungen ist.
// ---------------------------------------------------------------------------
eventRidesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/rides/{rideId}/riders/{riderId}',
    tags: ['event-rides'],
    summary: 'Zusage zurueckziehen oder erneuern',
    security: [{ bearerAuth: [] }],
    request: {
      params: riderParams,
      body: {
        content: { 'application/json': { schema: eventRideRiderUpdateSchema } },
        required: true,
      },
    },
    responses: {
      200: jsonContent(eventRideSchema, 'Fahrt inkl. aktualisierter Zusagen'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { rideId, riderId } = c.req.valid('param');
    const { status } = c.req.valid('json');

    const ride = await withUser(c.get('claims'), async (tx) => {
      const ref = await loadRideRef(tx, rideId);
      await requireClubMemberDb(c, ref.club_id);

      const updated = await tx`
        update app.event_ride_riders
           set status = ${status}
         where id = ${riderId} and ride_id = ${rideId} and deleted_at is null
         returning id`;
      if (updated.length === 0) {
        throw problem(403, 'Forbidden', 'Diese Zusage darfst du nicht aendern');
      }

      return readRide(tx, rideId);
    });

    return c.json(eventRideSchema.parse(ride), 200);
  },
);
