import * as mock from "@/lib/mock";
import { ApiError } from "../errors";
import type {
  ClubModuleState,
  EffectiveModule,
  ModuleRepository,
  ModuleVisibilityRow,
  ModuleVisibilityScope,
  SetModuleVisibilityInput,
} from "../inputs-clubmodules";
import { MODULE_CATALOG, MODULE_VISIBILITY_DEFAULTS } from "./seed-clubmodules";
import { departmentSeed } from "./seed-org";
import { LEVEL_RANK, SYSTEM_ROLE_SEED } from "./seed-rbac";

/** RFC-7807-Fehler wie ihn der Server schickt — gleiche Bauform wie modules-rbac.ts. */
function problem(status: number, title: string, detail: string): ApiError {
  return new ApiError(status, { type: "about:blank", title, status, detail }, detail);
}

/**
 * Mock-Implementierung des Modul-Schalters (Migration 0044).
 *
 * ### Warum das hier ERNST gemeint ist ###
 * lib/data/config.ts:16-17 zwingt JEDEN Production-Build auf 'mock'. Täte der
 * Mock nur so, wäre die Modul-Seite im Default-Modus genau das, was der Nutzer
 * hier schon zweimal zu Recht angeprangert hat: ein Formular, das nichts
 * speichert. Der Store unten ist deshalb echt — ein umgelegter Schalter bleibt
 * bis zum Reload umgelegt, und das „Mehr"-Raster reagiert sofort darauf.
 *
 * ### Was der Mock NICHT ist ###
 * Er setzt NICHTS durch. Er kennt keine RLS, keine restriktive Policy, kein
 * Entitlement. Im Mock verschwindet die Kachel — die Daten wären per API weiter
 * da, wenn es hier eine API gäbe. Die echte Durchsetzung ist der Server
 * (0044: restriktive RLS-Policies), nachgemessen in 99e_club_modules.sql.
 * Die Fehlerfälle des Servers werden NACHGEBILDET statt verschluckt:
 *   * Kernmodul abschalten -> 409 (wie der Trigger app.club_modules_guard)
 *   * unbekannter Schlüssel -> 404
 * Das 403 ohne Admin-Rolle bildet der Mock NICHT nach: er hat keinen Token und
 * keine Rollenauflösung. Die Oberfläche blendet den Schalter für Nicht-Admins
 * aus (Kosmetik) — durchgesetzt wird es serverseitig.
 */

/** Schalterstellungen dieser Session. Leer = alles an (wie 0044: fehlende Zeile = an). */
const switches = new Map<string, boolean>();

function stateOf(entry: (typeof MODULE_CATALOG)[number]): ClubModuleState {
  // Kernmodul: immer an — der Store kann es gar nicht erst umlegen (siehe unten).
  const enabled = entry.core ? true : (switches.get(entry.moduleKey) ?? true);
  return {
    ...entry,
    enabled,
    // Die Und-Kette aus 0044: eingeschaltet UND gekauft. Der Schalter hebelt
    // das PRO-Gate nicht aus — deshalb hier UND, nicht ODER.
    available: enabled && entry.proOk,
  };
}

export const moduleRepositoryClubModules: ModuleRepository = {
  async listClubModules(): Promise<ClubModuleState[]> {
    return MODULE_CATALOG.map(stateOf).sort((a, b) => a.sort - b.sort);
  },

  async setClubModuleEnabled(moduleKey: string, enabled: boolean): Promise<ClubModuleState> {
    const entry = MODULE_CATALOG.find((m) => m.moduleKey === moduleKey);
    if (!entry) {
      throw problem(404, "Not Found", `Unbekanntes Modul "${moduleKey}". / Unknown module "${moduleKey}".`);
    }

    // Der Kernmodul-Schutz — nachgebildet nach app.club_modules_guard() (0044).
    if (entry.core && !enabled) {
      throw problem(
        409,
        "Conflict",
        `Das Modul "${moduleKey}" ist ein Kernmodul und kann nicht abgeschaltet werden. ` +
          `Mitglieder, Finanzen (Aufbewahrungspflicht) und Verwaltung bleiben immer an. ` +
          `/ Module "${moduleKey}" is a core module and cannot be switched off. ` +
          `Members, finance (retention duty) and administration always stay on.`,
      );
    }

    switches.set(moduleKey, enabled);
    return stateOf(entry);
  },

  // --------------------------------------------------------------------------
  // Sichtbarkeit (0077) — siehe den Block am Dateiende: die Vorgabe wird auch
  // hier GERECHNET (Rang der Rolle gegen Mindeststufe), nicht gelistet.
  // --------------------------------------------------------------------------
  async listEffectiveModules(): Promise<EffectiveModule[]> {
    return MODULE_CATALOG.map(stateOf)
      .map((m) => {
        const r = resolveForCurrentUser(m.moduleKey);
        // Die UND-Kette aus 0044/0077: gekauft UND eingeschaltet UND angeboten.
        return { ...m, visible: m.available && r.visible, visibilitySource: r.source };
      })
      // Der Server liefert nur die sichtbaren — bewusst, damit ein Client, der
      // das Flag vergisst, nicht wieder alles zeigt.
      .filter((m) => m.visible)
      .sort((a, b) => a.sort - b.sort);
  },

  async listModuleVisibility(): Promise<ModuleVisibilityRow[]> {
    return visibilityRows();
  },

  async setModuleVisibility(
    moduleKey: string,
    input: SetModuleVisibilityInput,
  ): Promise<ModuleVisibilityRow[]> {
    const entry = MODULE_CATALOG.find((m) => m.moduleKey === moduleKey);
    if (!entry) {
      throw problem(404, "Not Found", `Unbekanntes Modul "${moduleKey}". / Unknown module "${moduleKey}".`);
    }

    // Der Weg zurück — nachgebildet nach app.module_visibility_guard() (0077):
    // wer die Verwaltung ausblendet, käme an die Einstellung nicht mehr heran.
    if (moduleKey === "manage") {
      throw problem(
        409,
        "Conflict",
        "Die Verwaltung kann nicht ausgeblendet werden — dort stehen die Einstellungen selbst, " +
          "ein Ausblenden wäre unumkehrbar. " +
          "/ Administration cannot be hidden: it holds the settings themselves.",
      );
    }

    const key = overrideKey(input.scope, input.targetId, moduleKey);
    if (input.visible === null) {
      visibilityOverrides.delete(key);
    } else {
      visibilityOverrides.set(key, input.visible);
    }
    return visibilityRows(moduleKey);
  },
};

// ============================================================================
// SICHTBARKEIT (Migration 0077) — die vierte Frage: WEM wird die Kachel
// angeboten?
//
// ### SICHTBARKEIT IST KEIN SICHERHEITSERSATZ ###
// Auch im Mock gilt: Ausblenden nimmt kein Recht, Einblenden gibt keins. Der
// Mock kennt ohnehin keine RLS — die Wahrheit ist der Server (0077), gemessen
// in 99rA_modul_sichtbarkeit.sql. Hier steht nur eine plausible Attrappe, damit
// die Verwaltungs-Seite ohne Dev-Stack BEDIENBAR ist und nicht wie ein
// Formular aussieht, das nichts tut.
//
// ### Warum die Vorgabe auch hier GERECHNET wird ###
// Sie könnte als feste Liste „Rolle X sieht Y" hier stehen — dann wäre sie ab
// dem ersten Klick in „Rollen & Rechte" falsch. Stattdessen dasselbe Verfahren
// wie in der Datenbank: Rang der Rolle auf der hinterlegten Fähigkeit gegen die
// Mindeststufe. Eine Wahrheit, zwei Implementierungen — und die hier ist die
// Attrappe.
// ============================================================================

/** Gesetzte Ausnahmen dieser Session: "<scope>:<targetId>:<moduleKey>" -> sichtbar. */
const visibilityOverrides = new Map<string, boolean>();

const overrideKey = (scope: ModuleVisibilityScope, targetId: string, moduleKey: string): string =>
  `${scope}:${targetId}:${moduleKey}`;

/** Der Rang einer ROLLE auf einer Fähigkeit — Gegenstück zu app.cap_rank ohne Person. */
function roleRank(roleKey: string, capabilityKey: string): number {
  const role = SYSTEM_ROLE_SEED.find((r) => r.key === roleKey);
  if (!role) return 0;
  // Die geschützte Inhaber-Rolle zählt überall 5 (app.cap_rank, 0025:232).
  if (role.protected) return 5;
  return LEVEL_RANK[role.permissions[capabilityKey] ?? "none"] ?? 0;
}

/** Die abgeleitete Vorgabe (app.module_role_default_visible). */
function defaultVisibleFor(roleKey: string, moduleKey: string): boolean {
  const rule = MODULE_VISIBILITY_DEFAULTS[moduleKey];
  if (!rule) return true; // keine Fähigkeit hinterlegt = immer sichtbar
  return roleRank(roleKey, rule.capability) >= rule.minRank;
}

/**
 * Die Auflösung für die eingeloggte Mock-Persona — Reihenfolge wie in 0077:
 * Mitglied > Gruppe > Rolle > Vorgabe. Gruppen sind hier die Abteilungen, in
 * denen die Persona steht.
 */
function resolveForCurrentUser(moduleKey: string): { visible: boolean; source: string } {
  const memberId = mock.currentUser.id;

  const own = visibilityOverrides.get(overrideKey("member", memberId, moduleKey));
  if (own !== undefined) return { visible: own, source: "member" };

  // Gruppen: ein ausdrückliches AUS gewinnt (restriktiv, Begründung in 0077).
  const groupValues = departmentSeed
    .filter((d) => d.memberIds.includes(memberId))
    .map((d) => visibilityOverrides.get(overrideKey("department", d.id, moduleKey)))
    .filter((v): v is boolean => v !== undefined);
  if (groupValues.length > 0) {
    return { visible: groupValues.every(Boolean), source: "department" };
  }

  // Rollen: Vereinigung (ein SICHTBAR gewinnt) — Semantik wie app.cap_rank.
  const roleKeys = [mock.currentUser.role as string];
  let visible = false;
  let hasOverride = false;
  for (const key of roleKeys) {
    const ov = visibilityOverrides.get(overrideKey("role", `role-${key}`, moduleKey));
    if (ov !== undefined) hasOverride = true;
    visible = visible || (ov ?? defaultVisibleFor(key, moduleKey));
  }
  return { visible, source: hasOverride ? "role" : "default" };
}

/** Die Matrix-Zeilen EINES Moduls (oder aller, wenn moduleKey fehlt). */
function visibilityRows(moduleKey?: string): ModuleVisibilityRow[] {
  const modules = MODULE_CATALOG.filter(
    // 'manage' nimmt keine Zeile an (Trigger app.module_visibility_guard):
    // sonst zeigte das UI einen Schalter, der immer scheitert.
    (m) => m.moduleKey !== "manage" && (moduleKey === undefined || m.moduleKey === moduleKey),
  );

  const roleRows: ModuleVisibilityRow[] = modules.flatMap((m) =>
    SYSTEM_ROLE_SEED.map((r) => {
      const def = defaultVisibleFor(r.key, m.moduleKey);
      const ov = visibilityOverrides.get(overrideKey("role", `role-${r.key}`, m.moduleKey));
      return {
        moduleKey: m.moduleKey,
        scope: "role" as const,
        targetId: `role-${r.key}`,
        targetLabel: r.nameDe,
        defaultVisible: def,
        override: ov ?? null,
        effective: ov ?? def,
      };
    }),
  );

  const exceptionRows: ModuleVisibilityRow[] = [];
  for (const [key, visible] of visibilityOverrides) {
    const [scope, targetId, mod] = key.split(":") as [ModuleVisibilityScope, string, string];
    if (scope === "role") continue;
    if (moduleKey !== undefined && mod !== moduleKey) continue;
    const label =
      scope === "department"
        ? (departmentSeed.find((d) => d.id === targetId)?.name ?? targetId)
        : (mock.memberById(targetId) ? mock.fullName(mock.memberById(targetId)!) : targetId);
    exceptionRows.push({
      moduleKey: mod,
      scope,
      targetId,
      targetLabel: label,
      defaultVisible: null,
      override: visible,
      effective: visible,
    });
  }

  return [...roleRows, ...exceptionRows];
}
