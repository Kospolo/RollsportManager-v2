/**
 * Kleiner Client-Event-Kanal für das eigene Profilfoto: die Profilseite meldet
 * einen Upload/Entfernen, das Topbar-Benutzermenü lädt daraufhin sein Foto neu.
 * Kein globaler Store nötig — ein window-CustomEvent hält die Shell-Komponenten
 * entkoppelt und wirkt nur im Client (SSR-No-op).
 */
export const AVATAR_CHANGED_EVENT = "rsm:avatar-changed";

/** Signalisiert allen Zuhörern (z. B. UserMenu), dass sich das eigene Foto änderte. */
export function notifyAvatarChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AVATAR_CHANGED_EVENT));
}
