// ============================================================================
// routes/invitations.ts — Annahme einer E-Mail-Einladung (Migration 0065).
//
// ZWEI ROUTEN, ZWEI VERTRAUENSSTUFEN:
//   * GET /public/invitations/{token}  — OEFFENTLICH (kein Login). Zeigt der
//     Annahme-Seite nur, WOHIN die Einladung fuehrt: Vereinsname + Zielrolle.
//     Kein Personendatum, kein Absender, kein Hinweis, ob die Adresse schon
//     Mitglied ist. Ungueltig/abgelaufen/verbraucht -> immer dieselbe 404.
//     Aufgeloest im SERVICE-MODE (ein oeffentlicher Besucher hat keine Claims,
//     RLS kann ohne Aufrufer nicht helfen) — genau wie public-routines.ts.
//   * POST /invitations/{token}/accept — ERFORDERT LOGIN. Die eingeladene
//     Person nimmt in EIGENEM Namen an (profile_id = auth.uid()). Die Anlage der
//     Mitgliedschaft laeuft NICHT ueber die RLS des Einladers (die eingeladene
//     Person ist nicht can_manage_members), sondern token-geprueft ueber
//     app.accept_invitation (SECURITY DEFINER). Der Token wird dabei verbraucht.
//
// DER TOKEN IN DER URL WIRD NIE GEGEN DIE DB GEHALTEN. Verglichen wird immer der
// SHA-256 (dieselbe Form, die 0065 speichert) — die DB kennt den Klartext nicht.
//
// STATUSWAHL: die Annahme legt eine AKTIVE Mitgliedschaft an, keinen zweiten
// Antrag. Begruendung im Migrationskopf (0065): die Einladung ist eine GEZIELTE
// Auswahl des Vorstands, der Token ist die Freigabe — im Unterschied zum
// geteilten Vereinscode, der nur die Warteschlange oeffnet (pending).
//
// KINDER (Art. 8): dieser Pfad erhebt NUR die alterslose Kenntnisnahme
// (terms/privacy, wie der Beitritt). Er erklaert KEINE echte Einwilligung — die
// bleibt der Familien-/Einwilligungspfad, wo app.enforce_consent_art8 (0039)
// den Art.-8-Zwang traegt. Ein wirkliches Kind wird ueber den Familienpfad
// angelegt, nicht per Selbstannahme (siehe 0065-Kopf).
// ============================================================================

import { createHash } from 'node:crypto';
import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  invitationAcceptInputSchema,
  invitationAcceptResultSchema,
  invitationInfoSchema,
  problemSchema,
} from '../lib/validation.js';
import { withServiceRole } from '../db.js';
import { problem } from '../middleware/error.js';
import { recordAcknowledgements } from '../lib/consent.js';

export const invitationsRouter = createRouter();

const tokenParam = z.object({
  token: z.string().min(1).max(200).openapi({ param: { name: 'token', in: 'path' } }),
});

/** SHA-256 (base64url) des vorgezeigten Tokens — die Form, die 0065 speichert. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** Die EINE Antwort auf jeden ungueltigen Token. Kein Leck, welcher Fall es war. */
function invalidInvitation(): never {
  throw problem(
    404,
    'Not Found',
    'Diese Einladung ist nicht (mehr) gültig. / This invitation is no longer valid.',
  );
}

// ---------------------------------------------------------------------------
// GET /public/invitations/{token} — oeffentliche Vorschau (Vereinsname + Rolle)
// ---------------------------------------------------------------------------
invitationsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/public/invitations/{token}',
    tags: ['registration'],
    summary: 'Einladung ansehen (oeffentlich) / Look up an invitation (public)',
    description:
      'Unauthentifiziert. Loest einen Einladungs-Token zu Vereinsname und Zielrolle auf — mehr nicht. Ein ' +
      'unbekannter, abgelaufener, widerrufener oder bereits angenommener Token liefert 404 (keine Auskunft, ' +
      'welcher Fall es war, kein Hinweis auf Mitgliedschaft).',
    request: { params: tokenParam },
    responses: {
      200: jsonContent(invitationInfoSchema, 'Vereinsname und Zielrolle der Einladung'),
      404: jsonContent(problemSchema, 'Token unbekannt, abgelaufen, widerrufen oder verbraucht'),
    },
  }),
  async (c) => {
    const { token } = c.req.valid('param');
    const tokenHash = hashToken(token);

    const info = await withServiceRole('public invitation lookup by token', async (tx) => {
      const rows = await tx<{ club_name: string; target_role: string }[]>`
        select c.name as club_name, i.target_role
        from app.invitations i
        join app.clubs c on c.id = i.club_id and c.deleted_at is null
        where i.token_hash = ${tokenHash}
          and i.status = 'pending'
          and i.expires_at > now()
        limit 1`;
      return rows[0];
    });

    if (info === undefined) invalidInvitation();
    return c.json(invitationInfoSchema.parse({ club_name: info.club_name, role: info.target_role }), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /invitations/{token}/accept — Einladung annehmen (Login erforderlich)
// ---------------------------------------------------------------------------
invitationsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/invitations/{token}/accept',
    tags: ['registration'],
    summary: 'Einladung annehmen / Accept an invitation',
    description:
      'Erfordert Login. Legt token-geprueft (app.accept_invitation, SECURITY DEFINER) eine AKTIVE Mitgliedschaft ' +
      'fuer die angemeldete Person an und verbraucht den Token. Erfasst die Kenntnisnahme von ' +
      'Nutzungsbedingungen und Datenschutzerklaerung (Pflicht, alterslos — KEINE echte Einwilligung). Ein ' +
      'ungueltiger/abgelaufener/bereits benutzter Token liefert dieselbe 404 wie die oeffentliche Vorschau.',
    security: [{ bearerAuth: [] }],
    request: {
      params: tokenParam,
      body: {
        content: { 'application/json': { schema: invitationAcceptInputSchema } },
        required: true,
      },
    },
    responses: {
      201: jsonContent(invitationAcceptResultSchema, 'Mitgliedschaft angelegt (status=active)'),
      409: jsonContent(problemSchema, 'Rechtstext-Fassung fehlt (Kenntnisnahme nicht nachweisbar)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { token } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    const tokenHash = hashToken(token);

    // SERVICE-MODE, autorisiert durch den TOKEN — genau wie der Code-Beitritt
    // (registration.ts). auth.uid() ist hier null, weshalb protect_member_roles
    // die Selbst-Rollenvergabe der annehmenden Person NICHT blockt (nur der
    // service_role-Pfad ist davon ausgenommen, 0024). Die Identitaet kommt als
    // VERIFIZIERTE claims.sub in die token-gepruefte Funktion.
    const result = await withServiceRole(
      'accept invitation by token (authorized by the token itself)',
      async (tx) => {
        // 0 Zeilen = Token ungueltig/abgelaufen/verbraucht ODER Verein
        // geloescht -> neutrale 404 (kein Unterschied).
        const accepted = await tx<{ club_id: string; club_name: string; member_id: string }[]>`
          select club_id, club_name, member_id
          from app.accept_invitation(${tokenHash}, ${claims.sub}, ${body.first_name}, ${body.last_name})`;
        const row = accepted[0];
        if (row === undefined) return undefined;

        // KENNTNISNAHME (nicht Einwilligung, 0039) in DERSELBEN Transaktion:
        // fehlt eine Fassung, wirft recordAcknowledgements 409 und ALLES rollt
        // zurueck — die Mitgliedschaft entsteht dann nicht und der Token bleibt
        // unbenutzt. Im Service-Mode ist RLS umgangen, die profile_id wird
        // (wie beim Beitritt) als Parameter gesetzt.
        await recordAcknowledgements(tx, {
          profileId: claims.sub,
          clubId: row.club_id,
          kinds: ['terms', 'privacy'],
          surface: 'POST /invitations/{token}/accept',
        });

        return row;
      },
    );

    if (result === undefined) invalidInvitation();
    return c.json(
      invitationAcceptResultSchema.parse({
        club_id: result.club_id,
        club_name: result.club_name,
        member_id: result.member_id,
        status: 'active',
      }),
      201,
    );
  },
);
