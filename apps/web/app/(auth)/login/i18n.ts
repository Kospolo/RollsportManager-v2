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

    // Echte Anmeldung (api-Modus): E-Mail/Passwort gegen die produktive API
    signInTitle: "Willkommen zurück",
    signInSub: "Melde dich mit deiner E-Mail-Adresse an.",
    registerTitle: "Konto erstellen",
    registerSub: "Ein Konto, dann Verein gründen oder beitreten.",
    nameLabel: "Dein Name",
    namePlaceholder: "Max Mustermann",
    accEmailLabel: "E-Mail-Adresse",
    accEmailPlaceholder: "name@verein.de",
    accPasswordLabel: "Passwort",
    accPasswordPlaceholder: "••••••••",
    accPasswordHintRegister: "Mindestens 8 Zeichen.",
    accForgot: "Passwort vergessen?",
    accSignIn: "Anmelden",
    accSigningIn: "Anmeldung läuft …",
    accRegister: "Konto erstellen",
    accRegistering: "Konto wird erstellt …",
    switchToRegister: "Noch kein Konto? Konto erstellen",
    switchToSignIn: "Schon ein Konto? Anmelden",
    accErrInvalid: "E-Mail oder Passwort stimmt nicht.",
    accErrExists: "Für diese E-Mail gibt es bereits ein Konto. Melde dich an.",
    accErrRateLimited: "Zu viele Versuche. Bitte in {seconds} Sekunden erneut versuchen.",
    accErrPasswordShort: "Das Passwort braucht mindestens 8 Zeichen.",
    accErrGeneric: "Das hat nicht geklappt: {message}",
    // Dev-Only: Abkürzung zu den Test-Personas (nur außerhalb von Produktion)
    devPersonasLink: "Entwickler: mit Test-Persona anmelden",
    devBackToAccount: "← Zur normalen Anmeldung",

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

    // Real sign-in (api mode): email/password against the production API
    signInTitle: "Welcome back",
    signInSub: "Sign in with your email address.",
    registerTitle: "Create account",
    registerSub: "One account, then start or join a club.",
    nameLabel: "Your name",
    namePlaceholder: "Alex Example",
    accEmailLabel: "Email address",
    accEmailPlaceholder: "name@club.com",
    accPasswordLabel: "Password",
    accPasswordPlaceholder: "••••••••",
    accPasswordHintRegister: "At least 8 characters.",
    accForgot: "Forgot your password?",
    accSignIn: "Sign in",
    accSigningIn: "Signing in …",
    accRegister: "Create account",
    accRegistering: "Creating account …",
    switchToRegister: "No account yet? Create one",
    switchToSignIn: "Already have an account? Sign in",
    accErrInvalid: "Email or password is incorrect.",
    accErrExists: "An account with this email already exists. Please sign in.",
    accErrRateLimited: "Too many attempts. Please retry in {seconds} seconds.",
    accErrPasswordShort: "The password needs at least 8 characters.",
    accErrGeneric: "That did not work: {message}",
    // Dev only: shortcut to the test personas (outside production only)
    devPersonasLink: "Developer: sign in with a test persona",
    devBackToAccount: "← Back to normal sign-in",

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
