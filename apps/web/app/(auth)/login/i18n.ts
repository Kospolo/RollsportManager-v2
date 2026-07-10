import type { Dict } from "@/lib/i18n";

/** Kolokalisiertes Dictionary des Login-Screens — DE und EN vollständig. */
export const loginDict = {
  de: {
    title: "Willkommen zurück",
    sub: "Melde dich im Portal deines Vereins an.",
    demoBanner: "Demo-Modus: beliebige Eingabe genügt.",

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
  },
  en: {
    title: "Welcome back",
    sub: "Sign in to your club's portal.",
    demoBanner: "Demo mode: any input will do.",

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
  },
} satisfies Dict;
