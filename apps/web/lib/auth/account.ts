import { apiClient } from "@/lib/data/api/client";
import { DATA_SOURCE } from "@/lib/data/config";
import {
  readSession,
  setSessionClub,
  writeSession,
  type AuthProfile,
  type AuthSession,
} from "./storage";

/**
 * Echte E-Mail/Passwort-Anmeldung des Portals (api-Modus).
 *
 * Anders als der Dev-Login (Persona-Karten, lib/auth/index.tsx) sprechen diese
 * Funktionen die produktive API an (POST /auth/login, /auth/register,
 * /auth/password-reset/*). Sie nutzen ausschliesslich den GENERIERTEN Client
 * (lib/api/generated) — keine handgeschriebenen fetch-Aufrufe.
 *
 * ### Der Ablauf nach Login/Register (identisch zur iOS-App) ###
 * Die Login-Antwort traegt KEIN club_id — das Profil kennt nur sub, E-Mail und
 * den Plattform-Claim. Deshalb:
 *   (1) Token holen + Session schreiben (writeSession), damit der Client den
 *       Bearer-Token fuer den naechsten Aufruf hat,
 *   (2) GET /me holen (RLS-scoped Mitgliedschaften, kann leer sein),
 *   (3) die erste AKTIVE Mitgliedschaft als aktiven Verein setzen
 *       (setSessionClub fuellt club_id/club_role/member_id),
 *   (4) hat die Person 0 aktive Vereine UND ist kein Plattform-Admin, bleibt
 *       club_id null — die Portal-Shell zeigt dann das „Kein Verein“-Onboarding
 *       (components/shell/OnboardingGate.tsx).
 *
 * Fehler werden NICHT geschluckt: sie fliegen als ApiError weiter, damit die
 * Formulare eine echte Meldung zeigen koennen (falsche Zugangsdaten = 401,
 * E-Mail bereits vergeben = 409, zu viele Versuche = 429).
 */

function assertApiMode(): void {
  if (DATA_SOURCE !== "api") {
    throw new Error(
      "Echte Anmeldung ist nur im api-Modus (NEXT_PUBLIC_DATA_SOURCE=api) verfügbar",
    );
  }
}

/**
 * Baut die localStorage-Session aus einer Login-Antwort. club_id bleibt hier
 * bewusst null — den aktiven Verein setzt resolveActiveClub() danach anhand von
 * GET /me, weil erst dort member_id und Rolle bekannt sind.
 */
function sessionFromLogin(
  accessToken: string,
  expiresIn: number,
  profile: { sub: string; email: string; is_platform_admin: boolean },
  displayName: string,
): AuthSession {
  const authProfile: AuthProfile = {
    sub: profile.sub,
    member_id: null,
    display_name: displayName || profile.email,
    email: profile.email,
    club_id: null,
    club_role: null,
    is_platform_admin: profile.is_platform_admin,
  };
  return {
    persona: "account",
    token: accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    profile: authProfile,
  };
}

/**
 * Holt GET /me und setzt die erste AKTIVE Mitgliedschaft als aktiven Verein.
 * Pending-Antraege zaehlen NICHT als Verein — wer nur einen offenen Antrag hat,
 * landet im Onboarding (mit Wartehinweis), nicht im Portal eines Vereins, in
 * dem er noch gar nicht freigegeben ist.
 *
 * Schlaegt GET /me fehl (z.B. weil das Konto brandneu und ohne Verein ist),
 * bleibt club_id null und die Person geht ins Onboarding — der Fehler wird
 * hier absichtlich verschluckt, denn „noch kein Verein“ ist kein Login-Fehler.
 */
async function resolveActiveClub(): Promise<void> {
  try {
    const me = await apiClient.getMe();
    const active = me.memberships.find((m) => m.status === "active");
    if (active) {
      setSessionClub(active.club_id, active.role, active.id);
    }
    // display_name aus /me nachziehen, falls die Registrierung keinen Namen
    // hatte und das Profil einen fuehrt.
    const current = readSession();
    if (current && me.display_name && current.profile.display_name === current.profile.email) {
      writeSession({
        ...current,
        profile: { ...current.profile, display_name: me.display_name },
      });
    }
  } catch {
    // Bewusst still: ein frisches Konto ohne Verein ist der Normalfall, kein
    // Anmeldefehler. Das Onboarding faengt es ab.
  }
}

/** Echte Anmeldung. Falsche Zugangsdaten -> ApiError (401). */
export async function authLogin(email: string, password: string): Promise<AuthSession> {
  assertApiMode();
  const res = await apiClient.postAuthLogin({ email: email.trim(), password });
  writeSession(sessionFromLogin(res.access_token, res.expires_in, res.profile, res.profile.email));
  await resolveActiveClub();
  return readSession() as AuthSession;
}

/**
 * Konto anlegen (E-Mail/Passwort + Anzeigename). Die Person ist danach sofort
 * angemeldet und kann einen Verein gruenden oder beitreten. E-Mail bereits
 * vergeben -> ApiError (409).
 */
export async function authRegister(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthSession> {
  assertApiMode();
  const res = await apiClient.postAuthRegister({
    email: email.trim(),
    password,
    display_name: displayName.trim(),
  });
  writeSession(
    sessionFromLogin(res.access_token, res.expires_in, res.profile, displayName.trim()),
  );
  await resolveActiveClub();
  return readSession() as AuthSession;
}

/**
 * Passwort-Zuruecksetzen ANFORDERN. Antwortet IMMER neutral (200), egal ob es
 * das Konto gibt — der Server verraet das nicht (keine Konto-Enumeration), und
 * die Oberflaeche tut es ihm gleich.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  assertApiMode();
  await apiClient.postAuthPasswordResetRequest({ email: email.trim() });
}

/**
 * Neues Passwort mit Reset-Token setzen. Ungueltiger/abgelaufener Token ->
 * ApiError (400). Der Token stammt aus dem Link der Reset-E-Mail
 * (${APP_BASE_URL}/passwort-neu?token=...).
 */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  assertApiMode();
  await apiClient.postAuthPasswordResetConfirm({ token, new_password: newPassword });
}
