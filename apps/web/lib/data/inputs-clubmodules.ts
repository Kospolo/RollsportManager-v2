/**
 * Facade-Segment „Module" (Migration 0044) — der Modul-Schalter pro Verein.
 *
 * ### DIE DREI FRAGEN, DIE MAN NICHT VERWECHSELN DARF ###
 * Es gibt drei Systeme, und dieses hier ist nur EINES davon:
 *
 *   1. GEKAUFT?       app.entitlements / is_club_pro (0012) -> `proOk`
 *   2. EINGESCHALTET? app.club_modules (0044)               -> `enabled`   <- HIER
 *   3. ERLAUBT?       app.capabilities (0022–0033)          -> getMyCapabilities()
 *
 * Zugriff gibt es nur, wenn ALLE DREI ja sagen. `available` ist die Und-Kette
 * aus 1 und 2 — Frage 3 beantwortet die Rechte-Auflösung und wird bewusst NICHT
 * hier hineingemischt: sie hängt an der PERSON, nicht am Verein.
 *
 * ### DER SCHALTER HEBELT DAS PRO-GATE NICHT AUS ###
 * Ein PRO-Modul ohne Entitlement bleibt zu, auch wenn `enabled` true ist —
 * dann ist `proOk` false und damit `available` false. Das ist keine Konvention
 * der Oberfläche, sondern Postgres-Semantik: der Schalter ist eine RESTRIKTIVE
 * Policy und kann strukturell nichts erlauben (0044).
 *
 * ### DIE FACADE PRÜFT NICHTS ###
 * Wie bei den Rechten: hier wird nur abgebildet, was der Server ohnehin
 * durchsetzt. Ein 403 ist eine normale Antwort, kein Programmfehler.
 */

/**
 * Was der Schalter WIRKLICH bewirkt (app.module_enforcement, 0044) — das
 * Muster stammt aus 0033 (CapabilityEnforcement) und hat denselben Zweck:
 * die Oberfläche darf nicht behaupten, etwas sei „aus", wenn die Daten per API
 * weiter abrufbar sind.
 *
 * - `enforced`  Der Schalter wirkt in der DATENBANK (restriktive RLS-Policy).
 *               Aus = jeder Lesezugriff liefert 0 Zeilen, jeder Schreibzugriff
 *               scheitert. Nur hier darf die Oberfläche „aus" ohne Fussnote sagen.
 * - `partial`   RLS greift, aber mindestens ein Server-Pfad umgeht sie
 *               (withServiceRole). Aus ist KEIN vollständiger Entzug (family).
 * - `menu_only` Der Schalter versteckt NUR die Kachel. Die Daten bleiben per
 *               API abrufbar — das MUSS dranstehen (chart, anniversaries).
 * - `null`      Kernmodul: es gibt gar keinen Schalter.
 */
export type ModuleEnforcement = "enforced" | "partial" | "menu_only";

/** Ein Modul samt Schalterstellung des Vereins (app.club_module_states). */
export interface ClubModuleState {
  /** Stabiler Schlüssel — identisch mit dem Tile-Key im „Mehr"-Raster. */
  moduleKey: string;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
  sort: number;
  /**
   * Kernmodul: kein Schalter. Mitglieder (sonst sperrt sich der Verein aus),
   * Finanzen (GoBD/AO §147 Aufbewahrungspflicht) und Verwaltung (sonst gibt es
   * keinen Weg zurück). Der Server weist ein Abschalten mit 409 ab — die
   * Oberfläche zeigt gar nicht erst einen Schalter.
   */
  core: boolean;
  /** PRO-Modul: hängt zusätzlich am Entitlement (0012). */
  requiresPro: boolean;
  /** Was der Schalter wirklich bewirkt — für die Beschriftung. null <=> core. */
  enforcement: ModuleEnforcement | null;
  /**
   * Voreinstellung für einen Verein OHNE eigene Schalter-Zeile
   * (app.modules.default_enabled, Migration 0068).
   *
   * `false` = ZUBUCHBARES Modul (Galerie, Dokumente, Notizen): ein neuer Verein
   * hat es AUS, bis er es bucht. `true`/fehlend = die Regel (von Haus aus an).
   *
   * Nur für die BESCHRIFTUNG: die Oberfläche unterscheidet damit „aus, weil der
   * Verein es abgeschaltet hat" von „nie gebucht" — zwei Sätze, zwei Auswege.
   * Autorisierung passiert hier nicht; das Gate ist die restriktive RLS-Policy.
   */
  defaultEnabled?: boolean;
  /** Die Schalterstellung. Nie angefasst = an (fehlende Zeile = an, 0044). */
  enabled: boolean;
  /** Entitlement erfüllt? Bei requiresPro=false immer true. */
  proOk: boolean;
  /** enabled UND proOk. Was das „Mehr"-Raster als vorhanden zeigen darf. */
  available: boolean;
}

export interface ModuleRepository {
  /**
   * Katalog + Schalterstellung des Vereins (GET /clubs/{clubId}/modules).
   * Für JEDES Mitglied lesbar — die Clients bauen daraus ihr Menü.
   */
  listClubModules(): Promise<ClubModuleState[]>;
  /**
   * Einen Schalter stellen (PUT /clubs/{clubId}/modules/{moduleKey}).
   * Gated `is_club_admin` (owner/admin/moderator) — durchgesetzt von der RLS,
   * nicht hier. 409 bei einem Kernmodul · 403 ohne Admin-Rolle.
   * Liefert den WIRKLICHEN Zustand zurück, nicht das Echo des Formulars:
   * bei einem PRO-Modul ohne Entitlement bleibt `available` false.
   */
  setClubModuleEnabled(moduleKey: string, enabled: boolean): Promise<ClubModuleState>;
}
