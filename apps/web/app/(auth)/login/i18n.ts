import type { Dict } from "@/lib/i18n";

/** Kolokalisiertes Dictionary des Login-Screens — DE und EN vollständig. */
export const loginDict = {
  de: {
    title: "Willkommen zurück",
    sub: "Melde dich im Portal deines Vereins an.",
    demoBanner: "Demo-Modus: beliebige Eingabe genügt.",
    // Fuehrt zu /entwickler. Ohne diesen Weg landet jede Anmeldung bei der
    // Vorgabe-Person (Trainerin) und Rollen lassen sich nicht vergleichen.
    viewAs: "Oder als andere Person ansehen \u2192",

    apple: "Mit Apple anmelden",
    google: "Mit Google anmelden",
    divider: "oder mit E-Mail",

    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "name@verein.de",
    passwordLabel: "Passwort",
    passwordPlaceholder: "••••••••",
    forgot: "Passwort vergessen?",
    forgotHint: "Im Demo-Modus nicht nötig — melde dich einfach mit beliebiger Eingabe an.",

    submit: "Anmelden",
    submitting: "Einen Moment …",

    noAccount: "Noch kein Vereinszugang?",
    seePlans: "Pakete ansehen",
    backHome: "Zur Startseite",

    // Dev-Login (api-Modus): Persona-Karten gegen den lokalen Dev-Stack
    devBanner: "Entwicklungsmodus: Anmeldung mit lokalen Test-Personas.",
    devTitle: "Wer bist du heute?",
    devSub: "Wähle eine Persona — echte Seed-Daten, echte Berechtigungen (RLS).",
    devSigningIn: "Anmeldung läuft …",
    devErrorTitle: "Der lokale Dev-Stack antwortet nicht",
    devErrorBody:
      "Die API unter Port 3022 ist nicht erreichbar. Starte den Stack im Projektordner mit:",
    devErrorRetry: "Erneut versuchen",
    devErrorGeneric: "Anmeldung fehlgeschlagen: {message}",
  },
  en: {
    title: "Welcome back",
    sub: "Sign in to your club's portal.",
    demoBanner: "Demo mode: any input will do.",
    viewAs: "Or view as a different person \u2192",

    apple: "Sign in with Apple",
    google: "Sign in with Google",
    divider: "or with email",

    emailLabel: "Email address",
    emailPlaceholder: "name@club.com",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    forgot: "Forgot your password?",
    forgotHint: "Not needed in demo mode — just sign in with any input.",

    submit: "Sign in",
    submitting: "One moment …",

    noAccount: "No club account yet?",
    seePlans: "See plans",
    backHome: "Back to homepage",

    // Dev login (api mode): persona cards against the local dev stack
    devBanner: "Development mode: sign in with local test personas.",
    devTitle: "Who are you today?",
    devSub: "Pick a persona — real seed data, real permissions (RLS).",
    devSigningIn: "Signing in …",
    devErrorTitle: "The local dev stack is not responding",
    devErrorBody:
      "The API on port 3022 is unreachable. Start the stack in the project folder with:",
    devErrorRetry: "Try again",
    devErrorGeneric: "Sign-in failed: {message}",
  },
} satisfies Dict;
