import { ApiError } from "@/lib/api/generated";
import type { Problem } from "@/lib/api/generated/types";
import { readSession } from "@/lib/auth/storage";
import { API_BASE_URL } from "../config";
import type {
  ClubModuleState,
  EffectiveModule,
  ModuleEnforcement,
  ModuleRepository,
  ModuleVisibilityRow,
  ModuleVisibilityScope,
  SetModuleVisibilityInput,
} from "../inputs-clubmodules";
import { activeClubId } from "./client";

/**
 * API-Implementierung des Modul-Schalters (Migration 0044).
 *
 * ### WARUM HIER fetch STEHT UND NICHT DER GENERIERTE CLIENT ###
 * Die zwei Endpoints (GET /clubs/{clubId}/modules, PUT …/{moduleKey}) sind NEU.
 * Der generierte Client (lib/api/generated) kennt sie noch nicht — und die
 * Codegen-Pipeline läuft in diesem Umbau bewusst NICHT (drei Trupps arbeiten
 * parallel; der Zusammenführer regeneriert EINMAL am Ende, sonst überschreiben
 * sich die Generate gegenseitig).
 *
 * Dieser fetch ist deshalb eine ÜBERGANGSLÖSUNG mit Verfallsdatum, kein Muster
 * zum Nachmachen. NACH dem Codegen-Lauf gehören die zwei Aufrufe unten auf
 * `apiClient.listClubModules(...)` / `apiClient.setClubModule(...)` umgestellt
 * und dieser Block gelöscht. Die Zod-Schemas dafür stehen bereits in
 * services/api/src/lib/validation.ts (clubModuleStateSchema, clubModuleSetSchema).
 *
 * Bis dahin bildet er den generierten Client so genau wie nötig nach: Bearer aus
 * der Dev-Session, RFC-7807 → ApiError (damit die Screens 403/409 gleich
 * behandeln wie überall sonst).
 *
 * ### Die Facade prüft nichts ###
 * Kein Vorab-Check auf Admin-Rolle oder Kernmodul. Der Server setzt durch
 * (RLS auf app.club_modules + Trigger app.club_modules_guard); ein 403 oder 409
 * ist hier eine normale Antwort.
 */

/** Die Antwortform von app.club_module_states() — snake_case wie die API. */
interface ClubModuleStateWire {
  module_key: string;
  label_de: string;
  label_en: string;
  desc_de: string;
  desc_en: string;
  sort: number;
  core: boolean;
  requires_pro: boolean;
  enforcement: ModuleEnforcement | null;
  /** Voreinstellung ohne eigene Schalter-Zeile (0068) — false = zubuchbar. */
  default_enabled: boolean;
  enabled: boolean;
  pro_ok: boolean;
  available: boolean;
}

/** app.my_effective_modules() — ClubModuleState + die zwei Sichtbarkeits-Felder. */
interface EffectiveModuleWire extends ClubModuleStateWire {
  visible: boolean;
  visibility_source: string;
}

/** app.club_module_visibility_matrix() — snake_case wie die API. */
interface ModuleVisibilityRowWire {
  module_key: string;
  scope: ModuleVisibilityScope;
  target_id: string;
  target_label: string;
  default_visible: boolean | null;
  override: boolean | null;
  effective: boolean;
}

function mapVisibilityRow(r: ModuleVisibilityRowWire): ModuleVisibilityRow {
  return {
    moduleKey: r.module_key,
    scope: r.scope,
    targetId: r.target_id,
    targetLabel: r.target_label,
    defaultVisible: r.default_visible,
    override: r.override,
    effective: r.effective,
  };
}

function mapState(m: ClubModuleStateWire): ClubModuleState {
  return {
    moduleKey: m.module_key,
    labelDe: m.label_de,
    labelEn: m.label_en,
    descDe: m.desc_de,
    descEn: m.desc_en,
    sort: m.sort,
    core: m.core,
    requiresPro: m.requires_pro,
    enforcement: m.enforcement,
    defaultEnabled: m.default_enabled,
    enabled: m.enabled,
    proOk: m.pro_ok,
    available: m.available,
  };
}

/** Übergangs-fetch — siehe Kopf. Verhält sich nach aussen wie der Generat-Client. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readSession()?.token ?? null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    // Wie der generierte Client: problem+json auslesen, sonst null.
    let problem: Problem | null = null;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      problem = null;
    }
    throw new ApiError(res.status, problem, problem?.detail ?? `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export const moduleApiRepositoryClubModules: ModuleRepository = {
  async listClubModules(): Promise<ClubModuleState[]> {
    const rows = await call<ClubModuleStateWire[]>(`/clubs/${activeClubId()}/modules`);
    return rows.map(mapState);
  },

  async setClubModuleEnabled(moduleKey: string, enabled: boolean): Promise<ClubModuleState> {
    const row = await call<ClubModuleStateWire>(
      `/clubs/${activeClubId()}/modules/${encodeURIComponent(moduleKey)}`,
      { method: "PUT", body: JSON.stringify({ enabled }) },
    );
    // Der Server antwortet mit dem WIRKLICHEN Zustand (neu gelesen, nicht das
    // Echo des Formulars): bei einem PRO-Modul ohne Entitlement bleibt
    // available false, obwohl enabled true ist. Genau das soll die Oberfläche
    // zeigen — deshalb wird hier nichts „korrigiert".
    return mapState(row);
  },

  // --------------------------------------------------------------------------
  // Sichtbarkeit (Migration 0077). NUR ein Menü — kein Zugriffsrecht: ein hier
  // fehlendes Modul bleibt über einen Deeplink genauso erreichbar bzw. gesperrt
  // wie vorher. Die Facade prüft dementsprechend auch hier NICHTS.
  // --------------------------------------------------------------------------
  async listEffectiveModules(): Promise<EffectiveModule[]> {
    const rows = await call<EffectiveModuleWire[]>(
      `/clubs/${activeClubId()}/modules/effective`,
    );
    return rows.map((m) => ({
      ...mapState(m),
      visible: m.visible,
      visibilitySource: m.visibility_source,
    }));
  },

  async listModuleVisibility(): Promise<ModuleVisibilityRow[]> {
    const rows = await call<ModuleVisibilityRowWire[]>(
      `/clubs/${activeClubId()}/modules/visibility`,
    );
    return rows.map(mapVisibilityRow);
  },

  async setModuleVisibility(
    moduleKey: string,
    input: SetModuleVisibilityInput,
  ): Promise<ModuleVisibilityRow[]> {
    const rows = await call<ModuleVisibilityRowWire[]>(
      `/clubs/${activeClubId()}/modules/${encodeURIComponent(moduleKey)}/visibility`,
      {
        method: "PUT",
        body: JSON.stringify({
          scope: input.scope,
          target_id: input.targetId,
          // null ist hier eine ECHTE Aussage („zurück auf die Vorgabe"), kein
          // fehlender Wert — deshalb wird sie mitgeschickt und nicht weggelassen.
          visible: input.visible,
        }),
      },
    );
    return rows.map(mapVisibilityRow);
  },
};
