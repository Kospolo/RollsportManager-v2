// ============================================================================
// routes/consents.ts — Einwilligungen erteilen, WIDERRUFEN und nachweisen.
//
// WARUM ES DIESE ROUTEN VORHER NICHT GAB — und warum das der Kern des Befunds
// ist: app.consents wurde ausschliesslich BEIM ANLEGEN beschrieben
// (clubs.ts:259, registration.ts:184), mit hart verdrahtetem granted=true fuer
// terms/privacy. Es gab keinen Weg, eine Einwilligung je wieder zu aendern.
// Art. 7 Abs. 3 DSGVO ist aber nicht optional: "Die betroffene Person hat das
// Recht, ihre Einwilligung jederzeit zu widerrufen", und der Widerruf muss so
// einfach sein wie die Erteilung. Eine Einwilligung ohne Widerrufsweg ist
// keine Einwilligung — sie ist eine Behauptung.
//
//   GET  /clubs/{clubId}/consents            der wirksame Stand (Nachweis)
//   POST /clubs/{clubId}/consents            erteilen ODER widerrufen
//
// KEIN Service-Mode. Anders als family.ts brauchen diese Routen ihn nicht: die
// Policy consents_insert (0034:552) erlaubt genau die richtigen Leute — sich
// selbst und eingetragene Vormuende — und der Trigger
// app.enforce_consent_art8 (0039) erzwingt Art. 8 zusaetzlich. Beides laeuft
// unter withUser, also mit RLS. Wer hier Service-Mode benutzte, schaltete
// genau die Wache ab, um die es geht.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { consentDeclareSchema, effectiveConsentSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const consentsRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });

/**
 * Uebersetzt die Absagen der Datenbank in eine Antwort, die man verstehen kann.
 *
 * Der Art.-8-Trigger und die RLS-Policy werfen 42501; der zusammengesetzte FK
 * wirft 23503. Ungefiltert kaeme davon ein 500 an — eine Einwilligung, die aus
 * gutem Grund abgelehnt wird, ist aber kein Serverfehler, sondern eine Auskunft
 * an die aufrufende Person. Die Meldung der Datenbank ist bereits die
 * Begruendung (sie nennt Alter und Artikel), deshalb wird sie durchgereicht.
 */
function translateConsentError(err: unknown): never {
  const e = err as { code?: string; message?: string };
  if (e?.code === '42501') {
    throw problem(403, 'Forbidden', e.message ?? 'Diese Einwilligung darf so nicht erklärt werden.');
  }
  if (e?.code === '23503') {
    throw problem(
      404,
      'Not Found',
      'Dieses Mitglied gehört nicht zu diesem Verein. / This member does not belong to this club.',
    );
  }
  if (e?.code === '23514') {
    throw problem(
      400,
      'Bad Request',
      'Dieser Zweck ist keine Einwilligung (Art. 6 Abs. 1 lit. b / Art. 13) und wird als Kenntnisnahme erfasst. / This purpose is not a consent.',
    );
  }
  throw err;
}

// ---------------------------------------------------------------------------
// GET /clubs/{clubId}/consents — der WIRKSAME Stand.
// ---------------------------------------------------------------------------
consentsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/consents',
    tags: ['members'],
    summary: 'Wirksamer Einwilligungsstand / Effective consent state',
    description:
      'Liefert je (Person, Zweck) die WIRKSAME Einwilligung aus app.effective_consents — nicht das rohe Journal. ' +
      'state=revoked (Art. 7 Abs. 3) und state=expired_age_16 (die Erklärung einer erziehungsberechtigten Person ' +
      'erlischt mit dem 16. Geburtstag) sind beide effective=false. RLS entscheidet, wer was sieht: die betroffene ' +
      'Person, wer erklärt hat, und die Mitglieder-Verwaltung.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      query: z.object({ member_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(effectiveConsentSchema), 'Wirksamer Stand'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const { member_id: memberId } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);

    const rows = await withUser(claims, async (tx: Tx) => {
      if (memberId !== undefined) {
        return tx`
          select * from app.effective_consents
          where club_id = ${clubId} and member_id = ${memberId}
          order by purpose`;
      }
      return tx`
        select * from app.effective_consents
        where club_id = ${clubId}
        order by member_id, purpose`;
    });

    return c.json(z.array(effectiveConsentSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/consents — erteilen ODER widerrufen.
// ---------------------------------------------------------------------------
consentsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/consents',
    tags: ['members'],
    summary: 'Einwilligung erteilen oder widerrufen / Grant or withdraw a consent',
    description:
      'Erteilt (granted=true) oder widerruft (granted=false) eine Einwilligung für EINEN Zweck. Der Widerruf ist ' +
      'derselbe Aufruf mit granted=false — genauso einfach wie die Erteilung (Art. 7 Abs. 3 Satz 4) — und legt eine ' +
      'NEUE Zeile an; die frühere bleibt als Nachweis erhalten. Bei Minderjährigen erklärt eine erziehungsberechtigte ' +
      'Person (Art. 8); ab 16 nur noch die betroffene Person selbst. terms/privacy sind hier NICHT zulässig: das ist ' +
      'Kenntnisnahme, keine Einwilligung.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: consentDeclareSchema } }, required: true },
    },
    responses: {
      201: jsonContent(effectiveConsentSchema, 'Erklärung erfasst'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims: AuthClaims = c.get('claims');
    requireClubMember(claims, clubId);

    const row = await withUser(claims, async (tx: Tx) => {
      // Die betroffene Person ist das MITGLIED, nicht der Aufrufer: bei einem
      // Kind erklaert das Elternteil, subject bleibt aber das Kind. Genau diese
      // Trennung ist der Art.-8-Nachweis (granted_by_profile_id <> subject).
      const members = await tx<{ profile_id: string | null }[]>`
        select profile_id from app.club_members
        where id = ${body.member_id} and club_id = ${clubId} and deleted_at is null`;
      const member = members[0];
      if (member === undefined) {
        throw problem(404, 'Not Found', 'Mitglied nicht in diesem Verein gefunden. / Member not found in this club.');
      }

      try {
        const inserted = await tx`
          insert into app.consents
            (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id,
             policy_version, evidence)
          values (${clubId}, ${body.member_id}, ${member.profile_id}, ${body.purpose},
                  ${body.granted}, ${claims.sub}, ${body.policy_version ?? null},
                  ${tx.json({ surface: 'POST /clubs/{clubId}/consents' })})
          returning id`;
        const id = inserted[0]?.['id'] as string | undefined;
        if (id === undefined) throw problem(500, 'Internal Server Error', 'consent insert failed');

        const rows = await tx`select * from app.effective_consents where id = ${id}`;
        return rows[0];
      } catch (err) {
        return translateConsentError(err);
      }
    });

    return c.json(effectiveConsentSchema.parse(row), 201);
  },
);
