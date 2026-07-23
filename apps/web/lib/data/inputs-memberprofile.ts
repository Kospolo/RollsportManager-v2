import type { MemberAssessment, MemberCoachNote, MemberProfile } from "@/lib/api/generated";
import type { Id } from "@/lib/types";

/**
 * Facade-Segment „360-Grad-Profil" — der EINE Aggregat-Endpunkt einer Person.
 *
 *   GET  /clubs/{clubId}/members/{memberId}/profile   → getMemberProfile
 *   POST /assessments                                 → createMemberAssessment
 *
 * Die Response ist bewusst der GENERIERTE Vertragstyp (MemberProfile), kein
 * eigenes View-Modell: die Sichtbarkeit je Sektion wird SERVERSEITIG gestaffelt
 * (null = darf ich nicht → Sektion ausblenden; [] = erlaubt, aber leer). Ein
 * Zwischen-Mapping würde diese Leitplanke nur verwässern. Der Mock-Modus baut
 * dieselbe Form nach und wendet dieselben Gates an (lib/data/mock).
 */

export interface CreateAssessmentInput {
  memberId: Id;
  /** Beurteilungstext (Pflicht). */
  body: string;
  /** Technik 1–5 (optional). */
  ratingTechnik?: number;
  /** Ausdruck 1–5 (optional). */
  ratingAusdruck?: number;
  /** ISO-Datum (YYYY-MM-DD); Default heute. */
  assessedOn?: string;
}

export interface MemberProfileRepository {
  /**
   * Das 360-Grad-Profil EINER Person. Jede Sektion ist rollen-gestaffelt:
   * null = der/die Betrachter:in darf sie nicht sehen (im UI GAR NICHT rendern),
   * [] / leeres Objekt = erlaubt, aber leer.
   */
  getMemberProfile(memberId: Id): Promise<MemberProfile>;
  /**
   * Trainer-Beurteilung schreiben — nur Team-Trainer:in der Person ODER
   * Vorstand (serverseitig erzwungen; ein 403 bleibt möglich).
   */
  createMemberAssessment(input: CreateAssessmentInput): Promise<MemberAssessment>;

  /**
   * Die INTERNEN Trainer-Notizen über eine Person (0069).
   *
   * ⚠️ BEWUSST EIN EIGENER AUFRUF, NICHT TEIL VON getMemberProfile.
   * Das Profil-Aggregat ist genau die Route, die ein Elternteil für sein Kind
   * öffnet. Interne Notizen gehören nicht in eine Antwort, deren Publikum die
   * Familie IST — auch dann nicht, wenn der Server sie herausfiltern würde.
   * Wer sie hier hineinzieht, hebelt die Trennung aus, um die es geht.
   *
   * Für Unberechtigte liefert der Server 200 mit LEERER Liste (kein 403 — ein
   * Fehlercode wäre schon die Auskunft „da ist etwas").
   */
  listMemberCoachNotes(memberId: Id): Promise<MemberCoachNote[]>;
  /**
   * Interne Notiz schreiben — nur Trainer:in DES MITGLIEDS oder Vereinsleitung,
   * und niemals über sich selbst oder das eigene Kind (serverseitig erzwungen).
   */
  createMemberCoachNote(input: CreateCoachNoteInput): Promise<MemberCoachNote>;
}

export interface CreateCoachNoteInput {
  memberId: Id;
  /** Der Notiztext (Pflicht, max. 4000 Zeichen). */
  body: string;
}
