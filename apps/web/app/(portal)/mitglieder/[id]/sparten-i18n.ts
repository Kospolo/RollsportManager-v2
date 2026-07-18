import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Sparten-Zugehörigkeit AUF DER MITGLIEDER-
 * Detailseite (Karte + Zuordnungs-Sheet). IMMER beide Sprachen vollständig,
 * deutsche Strings mit echten Umlauten.
 *
 * Rechte SERVERSEITIG (RLS + Rollencheck, Migration 0062–0064): Roster setzen =
 * can_manage_sparten (owner/admin/treasurer + Plattform-Admin, NICHT
 * moderator/coach/member). Lesen = jedes Mitglied. Die Sichtbarkeit des
 * Editier-Knopfs ist Komfort; ein 403 kommt als Klartext-Toast + Rollback.
 */
export const memberSpartenDict = {
  de: {
    eyebrow: "Sparten",
    title: "Sparten",
    none: "Noch keiner Sparte zugeordnet.",
    inactiveBadge: "Inaktiv",
    manageCta: "Sparten zuordnen",
    editCta: "Zuordnung bearbeiten",

    /* Sheet */
    sheetEyebrow: "Sparten",
    sheetTitle: "Sparten — {name}",
    sheetHint: "Wähle die Sparten aus, denen {name} angehört. Ein Mitglied kann in mehreren Sparten sein.",
    noSparten: "Es gibt noch keine Sparten im Verein.",
    selectedSummaryOne: "{n} Sparte ausgewählt",
    selectedSummaryMany: "{n} Sparten ausgewählt",
    cancel: "Abbrechen",
    save: "Zuordnung speichern",
    savedToast: "Sparten von {name} gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
  },
  en: {
    eyebrow: "Divisions",
    title: "Divisions",
    none: "Not assigned to a division yet.",
    inactiveBadge: "Inactive",
    manageCta: "Assign divisions",
    editCta: "Edit assignment",

    /* Sheet */
    sheetEyebrow: "Divisions",
    sheetTitle: "Divisions — {name}",
    sheetHint: "Pick the divisions {name} belongs to. A member can be in several divisions.",
    noSparten: "There are no divisions in the club yet.",
    selectedSummaryOne: "{n} division selected",
    selectedSummaryMany: "{n} divisions selected",
    cancel: "Cancel",
    save: "Save assignment",
    savedToast: "Divisions of {name} saved.",
    forbidden: "You don't have permission to do that.",
  },
} satisfies Dict;
