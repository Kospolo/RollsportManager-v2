import * as mock from "@/lib/mock";
import type { Member } from "@/lib/types";

/**
 * DER EINE In-Memory-Mitglieder-Store des Mock-Modus.
 *
 * Bewusst als eigenes Modul: sowohl die Verzeichnis-Reads (mock/index.ts →
 * getMembers/getMemberById) als auch der Selbstsicht-Schreibpfad
 * (mock/modules-me.ts → updateMyProfile) müssen auf DENSELBEN Objekten
 * arbeiten. Lägen sie in index.ts, müsste modules-me zirkulär importieren —
 * und ohne gemeinsamen Store hätte „Über mich speichern" im Mock ins Leere
 * geschrieben: der Toast wäre grün, die Mitglieder-Karte aber leer geblieben.
 *
 * Lebt für die Dauer der Session (bis Reload).
 */
export const memberStore: Member[] = mock.members.map((m) => ({ ...m, teamIds: [...m.teamIds] }));

/** Die eingeloggte Mock-Persona IM Store (Sandra Vogel) — nie mock.currentUser mutieren. */
export function selfMember(): Member {
  return memberStore.find((m) => m.id === mock.currentUser.id) ?? memberStore[0];
}
