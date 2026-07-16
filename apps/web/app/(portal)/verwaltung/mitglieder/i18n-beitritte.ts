import type { Dict } from "@/lib/i18n";

/** Dictionary der Beitritts-Freigabe — DE und EN, echte Umlaute. */
export const joinRequestsDict = {
  de: {
    title: "Beitrittsanträge",
    sub: "Diese Personen kennen euren Vereinscode. Drin sind sie damit noch nicht.",
    requestedAt: "Beantragt am {date}",
    approve: "Freigeben",
    approving: "Wird freigegeben …",
    reject: "Ablehnen",
    rejectSure: "Wirklich ablehnen?",
    rejectConfirm: "Ja, ablehnen",
    cancel: "Abbrechen",
    footnote:
      "Die Freigabe wirkt sofort — die Person muss sich dafür nicht neu anmelden. Eine Ablehnung ist keine Sperre: sie darf erneut fragen. Kommt der Code abhanden, könnt ihr ihn unter Verein neu erzeugen.",
  },
  en: {
    title: "Join requests",
    sub: "These people know your club code. That does not mean they are in.",
    requestedAt: "Requested on {date}",
    approve: "Approve",
    approving: "Approving …",
    reject: "Reject",
    rejectSure: "Really reject?",
    rejectConfirm: "Yes, reject",
    cancel: "Cancel",
    footnote:
      "Approval takes effect immediately — the person does not need to sign in again. A rejection is not a ban: they may ask again. If the code leaks, you can regenerate it under Club.",
  },
} satisfies Dict;
