// ============================================================================
// lib/consent.ts — Einwilligung (Art. 6 Abs. 1 lit. a) und Kenntnisnahme
// (Art. 13 / Art. 6 Abs. 1 lit. b) ERFASSEN. Getrennt, weil es zwei Dinge sind.
//
// WARUM DIESE DATEI UEBERHAUPT EXISTIERT:
// Bis Migration 0039 gab es genau zwei Stellen, die etwas in app.consents
// schrieben — clubs.ts:259-266 (POST /clubs) und registration.ts:184-191
// (POST /clubs/join). Beide schrieben dieselbe Schleife ueber
// ['terms','privacy'] mit granted=true und OHNE legal_document_id. Damit war
//   * der einzige erfasste Inhalt derjenige, der KEINE Einwilligung ist, und
//   * der Nachweis wertlos, weil er auf keinen Wortlaut zeigte (Art. 7 Abs. 1).
// Die vier ECHTEN Zwecke (photos_internal, photos_public, chat, newsletter)
// kamen im gesamten Baum nicht ein einziges Mal als Wert vor.
//
// Diese Datei ist die EINE Stelle, die beides richtig schreibt. Sie ersetzt die
// beiden kopierten Schleifen; der Zusammenfuehrer haengt sie dort ein (siehe
// Bericht). Bewusst als Funktionen ueber `Tx` statt als Route: sie muessen in
// DERSELBEN Transaktion laufen wie die Anlage des Mitglieds — eine Anmeldung,
// deren Einwilligung danach separat scheitern kann, ist schlimmer als keine.
// ============================================================================

import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';

/** Zwecke, die eine ECHTE Einwilligung sind (Art. 6 Abs. 1 lit. a). */
export const REAL_CONSENT_PURPOSES = [
  'photos_internal',
  'photos_public',
  'chat',
  'newsletter',
] as const;
export type RealConsentPurpose = (typeof REAL_CONSENT_PURPOSES)[number];

/**
 * Rechtstexte, die zur KENNTNIS genommen werden — KEINE Einwilligung.
 *
 * 'terms'   = Art. 6 Abs. 1 lit. b (Vertragsschluss): die Bedingungen
 *             anzunehmen IST der Vertrag, nicht die Einwilligung in ihn.
 * 'privacy' = Art. 13 (Informationspflicht): man willigt in eine
 *             Datenschutzerklaerung nicht ein, man nimmt sie zur Kenntnis.
 *
 * Sie in app.consents zu schreiben (so war es) verletzt das Kopplungsverbot
 * (Art. 7 Abs. 4): validation.ts deklariert accept_terms/accept_privacy als
 * z.literal(true), also PFLICHT — ein Pflicht-Haken in der
 * Einwilligungstabelle laesst die freiwilligen Haken danebem ebenfalls wie
 * Pflicht wirken und macht sie damit unwirksam. Migration 0039 weist
 * terms/privacy in app.consents deshalb per CHECK ab.
 */
export const ACKNOWLEDGEMENT_KINDS = ['terms', 'privacy'] as const;
export type AcknowledgementKind = (typeof ACKNOWLEDGEMENT_KINDS)[number];

/**
 * Die AKTUELLE Fassung eines Rechtstextes (hoechste version je kind+locale).
 *
 * internal.legal_documents ist append-only und versioniert (0034:388-405) —
 * eigens gebaut, damit eine Erklaerung auf einen UNVERAENDERLICHEN Wortlaut
 * zeigen kann. Bis 0039 hat diese Tabelle niemand gelesen.
 */
export async function currentLegalDocumentId(
  tx: Tx,
  kind: AcknowledgementKind | 'imprint',
  locale: 'de' | 'en' = 'de',
): Promise<string | null> {
  const rows = await tx<{ id: string }[]>`
    select id from internal.legal_documents
    where kind = ${kind} and locale = ${locale}
    order by version desc
    limit 1`;
  return rows[0]?.id ?? null;
}

/**
 * KENNTNISNAHME erfassen — je Rechtstext eine Zeile, mit Fassungszeiger.
 *
 * Wirft 409, wenn der Betreiber den Text noch nicht hinterlegt hat: ohne
 * Fassung gibt es nichts zur Kenntnis zu nehmen, und ein Eintrag ohne Zeiger
 * waere genau der wertlose Nachweis, den 0039 abgeschafft hat
 * (policy_acknowledgements.legal_document_id ist NOT NULL). Lieber eine klare
 * Absage als eine Anmeldung, die hinterher nichts belegt.
 */
export async function recordAcknowledgements(
  tx: Tx,
  args: {
    profileId: string;
    clubId: string | null;
    kinds: readonly AcknowledgementKind[];
    locale?: 'de' | 'en';
    surface: string;
  },
): Promise<void> {
  for (const kind of args.kinds) {
    const documentId = await currentLegalDocumentId(tx, kind, args.locale ?? 'de');
    if (documentId === null) {
      throw problem(
        409,
        'Conflict',
        `Für "${kind}" ist noch keine Fassung hinterlegt — eine Kenntnisnahme ohne Wortlaut wäre kein Nachweis (Art. 7 Abs. 1 DSGVO). / No version of "${kind}" has been published yet.`,
      );
    }
    await tx`
      insert into app.policy_acknowledgements (profile_id, club_id, kind, legal_document_id, evidence)
      values (${args.profileId}, ${args.clubId}, ${kind}, ${documentId},
              ${tx.json({ surface: args.surface })})`;
  }
}

/**
 * ECHTE Einwilligungen erfassen — je Zweck eine Zeile (Art. 7 Abs. 2: kein
 * Sammel-Ja).
 *
 * NICHT angegebene Zwecke werden NICHT geschrieben. Das ist Absicht: ein nicht
 * gesetzter Haken ist keine Einwilligung mit granted=false, sondern GAR KEINE
 * Erklaerung — Schweigen ist nach Art. 4 Nr. 11 keine Willensbekundung, in
 * keine Richtung. Wer hier ein 'false' erfaende, behauptete eine Ablehnung, die
 * niemand ausgesprochen hat.
 *
 * Den Art.-8-Zwang (wer darf fuer wen erklaeren, ab welchem Alter) prueft
 * NICHT diese Funktion, sondern der Trigger app.enforce_consent_art8 (0039).
 * Das ist bewusst: die Regel muss auch dann gelten, wenn jemand an dieser
 * Funktion vorbei schreibt — und der Service-Mode der API taete genau das.
 */
export async function recordConsents(
  tx: Tx,
  args: {
    clubId: string;
    memberId: string | null;
    subjectProfileId: string;
    grantedByProfileId: string;
    consents: Partial<Record<RealConsentPurpose, boolean>>;
    policyVersion?: string;
    surface: string;
  },
): Promise<number> {
  let written = 0;
  for (const purpose of REAL_CONSENT_PURPOSES) {
    const granted = args.consents[purpose];
    if (granted === undefined) continue;
    await tx`
      insert into app.consents
        (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id,
         policy_version, evidence)
      values (${args.clubId}, ${args.memberId}, ${args.subjectProfileId}, ${purpose},
              ${granted}, ${args.grantedByProfileId}, ${args.policyVersion ?? null},
              ${tx.json({ surface: args.surface })})`;
    written += 1;
  }
  return written;
}
