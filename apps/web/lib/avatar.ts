/**
 * Avatar-Farbwelt (Signatur des Design-Systems, §2.3):
 * Hash aus der personId → einer von sechs warmen Tönen,
 * deterministisch und plattformübergreifend identisch
 * („Lina ist plum — überall").
 */

export const AVATAR_TONES = ["berry", "coral", "honey", "moss", "plum", "petrol"] as const;

export type AvatarTone = (typeof AVATAR_TONES)[number];

/** FNV-1a-artiger Hash — stabil, ohne Abhängigkeiten, identisch auf allen Plattformen. */
export function avatarTone(personId: string): AvatarTone {
  let hash = 2166136261;
  for (let i = 0; i < personId.length; i++) {
    hash ^= personId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/**
 * Jury-Fix aus DESIGN-SYSTEM §2.3: Auf den helleren Tönen honey und moss
 * sind weiße Initialen unter AA — dort dunkle Initialen verwenden.
 */
export function avatarInkClass(tone: AvatarTone): string {
  return tone === "honey" || tone === "moss" ? "text-on-avatar-dark" : "text-on-avatar";
}

export const AVATAR_BG_CLASS: Record<AvatarTone, string> = {
  berry: "bg-av-berry",
  coral: "bg-av-coral",
  honey: "bg-av-honey",
  moss: "bg-av-moss",
  plum: "bg-av-plum",
  petrol: "bg-av-petrol",
};

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
