import type { PlatformSettings } from "@/lib/types";
import type { UpdatePlatformSettingsInput } from "@/lib/data";

/**
 * Gemeinsame Typen der Plattform-Einstellungs-Tabs. `applyPatch` schickt einen
 * Teil-Patch an PATCH /platform/settings (Deep-Merge serverseitig) und liefert
 * die vollständigen, frisch maskierten Einstellungen zurück (SMTP-Passwort NUR
 * als passwordSet). Damit reconciled der Shell-State und alle Tabs bleiben
 * synchron. `savedTone` steuert den Erfolgs-Toast: im api-Modus "success"
 * (wirklich persistiert), im mock-Modus "info" (nur lokal).
 */
export type ApplyPatch = (patch: UpdatePlatformSettingsInput) => Promise<PlatformSettings>;

export interface PanelProps {
  settings: PlatformSettings;
  applyPatch: ApplyPatch;
  savedTone: "success" | "info";
}
