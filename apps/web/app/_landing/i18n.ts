import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der öffentlichen Landingpage —
 * DE und EN immer beide vollständig, deutsche Strings mit echten Umlauten.
 */
export const landingDict = {
  de: {
    appName: "RollsportManager",
    skipToContent: "Zum Inhalt springen",
    languageLabel: "Sprache wechseln",

    /* Topbar */
    navLabel: "Seitenbereiche",
    navFeatures: "Funktionen",
    navPricing: "Preise",
    navFaq: "Fragen",
    login: "Anmelden",

    /* Hero */
    heroEyebrow: "Vereins-Software für Rollkunstlauf",
    heroTitle: "Termine, Kür-Musik und Beiträge — alles an einem Ort.",
    heroSub:
      "RollsportManager nimmt eurem Verein die Zettelwirtschaft ab: Zu- und Absagen in Sekunden, Kür-Musik mit Loop und Tempo direkt am Hallenrand, Mahnungen mit eingebauter Freigabe. Für Vorstand, Trainerteam und Eltern.",
    heroCtaPrimary: "Kostenlos testen",
    heroCtaSecondary: "Funktionen ansehen",
    heroFreeNote: "Mitglieder & Eltern immer kostenlos · monatlich kündbar",

    /* Hero-Vorschau (stilisierte App-Karte) */
    previewClub: "RSV Neckarsulm · Übersicht",
    previewCountdown: "Nächster Wettkampf",
    previewDays: "{n} Tage",
    previewNextTraining: "Nächstes Training",
    previewOpen: "Offene Posten",
    previewOpenSub: "{n} Rechnungen · Mahn-Automatik aktiv",
    previewRoutine: "Kür-Musik",
    previewRoutineMeta: "{title} · {duration}",
    previewPlay: "Kür anspielen (Vorschau)",

    /* Feature 1 — Küren-Studio (USP) */
    f1Eyebrow: "Küren-Studio",
    f1Title: "Die Kür-Musik gehört in die Halle, nicht ins Tonstudio.",
    f1Body:
      "Musik hochladen, schwierige Passagen in die Schleife legen, Tempo fürs Training drosseln — die Tonhöhe bleibt erhalten. Aus dem Musikstück wird ein Trainingsplan.",
    f1Point1: "A–B-Loop mit beschrifteten Griffen — die Sprungkombination läuft, bis sie sitzt",
    f1Point2: "Tempo 50–100 % ohne Tonhöhenänderung — bei 85 % läuft „{title}“ {slowed} statt {normal}",
    f1Point3: "Zeitmarken mit RollArt-Kürzeln (2S, SSp, StSq) — „ab hier abspielen“ je Element",
    f1InLoop: "im Loop",
    f1WaveLabel: "Wellenform der Kür „{title}“ mit A–B-Schleife",

    /* Feature 2 — Termine & Anwesenheit */
    f2Eyebrow: "Termine & Anwesenheit",
    f2Title: "Wer kommt heute zum Training? Eine Frage, sofort beantwortet.",
    f2Body:
      "Eltern sagen mit einem Tipp zu oder ab — inklusive Grund. Das Trainerteam sieht am Hallenrand, mit wem es planen kann, und hakt die Anwesenheit direkt ab.",
    f2Point1: "Zu- und Absagen mit einem Tipp — auch für Eltern ohne App-Erfahrung",
    f2Point2: "Klartext statt Farbcode: „9 Zusagen · 1 Absage · 4 offen“",
    f2Point3: "Check-in-Liste fürs Training — Anwesenheit in unter einer Minute erledigt",

    /* Feature 3 — Finanzen & Mahnwesen */
    f3Eyebrow: "Beiträge & Mahnwesen",
    f3Title: "Beiträge einsammeln, ohne jemandem hinterherzulaufen.",
    f3Body:
      "Rechnungen, Kassenbuch und eine Mahn-Automatik, die freundlich beginnt und nie über euren Kopf hinweg eskaliert: Ab Stufe 2 wird nichts ohne Freigabe versendet.",
    f3Point1: "Automatische Erinnerung nach 7 Tagen — freundlich und in eurem Namen",
    f3Point2: "Vierstufige Mahn-Treppe mit klaren Worten statt Alarm-Rot über Personen",
    f3Point3: "Beträge auf den Cent konsistent — von der Kachel bis zur Summenzeile",
    f3Microcopy: "Stufe 2+ wird nie automatisch versendet — Freigabe durch den Vorstand.",
    f3InvoicesWord: "{n} Posten",

    /* Preise */
    pricingEyebrow: "Preise",
    pricingTitle: "Ein Preis pro Verein. Fertig.",
    pricingSub: "Keine Einrichtungsgebühr, keine Vertragslaufzeit — ihr könnt monatlich kündigen.",
    alwaysFree: "Mitglieder & Eltern immer kostenlos",
    perMonth: "pro Monat und Verein",
    popular: "Beliebt",
    vatNote: "Alle Preise zzgl. MwSt. · 30 Tage kostenlos testen, ohne Zahlungsdaten",
    tierCta: "Kostenlos testen",

    p1Name: "Verein Basis",
    p1Price: "29 €",
    p1Audience: "Für kleine Vereine bis 50 Mitglieder",
    p1F1: "Termine mit Zu- und Absagen",
    p1F2: "Mitglieder- und Familienverwaltung",
    p1F3: "Anwesenheit per Check-in-Liste",
    p1F4: "Deutsch und Englisch für alle",

    p2Name: "Verein Pro",
    p2Price: "49 €",
    p2Audience: "Für aktive Vereine bis 200 Mitglieder",
    p2F1: "Alles aus Basis",
    p2F2: "Küren-Studio: Loop, Tempo, Zeitmarken",
    p2F3: "Beiträge, Rechnungen und Kassenbuch",
    p2F4: "Mahn-Automatik mit Vorstands-Freigabe",
    p2F5: "SEPA-Mandate für den Beitragseinzug verwalten",

    p3Name: "Verein Premium",
    p3Price: "79 €",
    p3Audience: "Für große Vereine — Mitglieder unbegrenzt",
    p3F1: "Alles aus Pro",
    p3F2: "Wettkampf-Planung und RollArt-Verlauf",
    p3F3: "Bankabgleich mit Zuordnungs-Vorschlägen",
    p3F4: "Berichte und GoBD-konformer Export",
    p3F5: "Persönlicher Support mit Rückrufnummer",

    /* FAQ */
    faqEyebrow: "Häufige Fragen",
    faqTitle: "Bevor ihr den Vorstand überzeugt",
    q1: "Was zahlen Mitglieder und Eltern?",
    a1: "Nichts — versprochen. Den Paketpreis zahlt der Verein, alle Mitglieder, Eltern und Trainerinnen nutzen die App kostenlos. Es gibt keine Pro-Kopf-Preise und keine versteckten Zusatzkosten.",
    q2: "Wie kommen unsere Daten aus Excel oder der alten Software hierher?",
    a2: "Beim Umzug helfen wir persönlich und übernehmen die Daten gemeinsam mit euch. Ehrlich gesagt: einen fertigen CSV-Import für Mitglieder, Familien und offene Beiträge gibt es noch nicht. Kontoauszüge lassen sich bereits als CSV einlesen.",
    q3: "Wo liegen unsere Daten und was ist mit dem Datenschutz?",
    a3: "Jeder Verein sieht ausschließlich seine eigenen Daten — die Trennung ist in der Datenbank erzwungen, nicht bloß in der Oberfläche. Wer was sehen darf, regeln Rollen und Rechte: Eine Krankmeldung etwa sehen nur die Familie selbst und das Trainerteam des Kindes, nicht der ganze Verein. Hosting, Auftragsverarbeitung und Datenexport halten wir verbindlich im Vertrag fest — hier versprechen wir euch nichts, was wir nicht auch schriftlich geben.",
    q4: "Können wir das erst einmal ausprobieren?",
    a4: "Ja — 30 Tage kostenlos, ohne Zahlungsdaten und mit allen Pro-Funktionen. Danach entscheidet ihr euch für ein Paket oder der Zugang pausiert einfach. Gekündigt wird monatlich, formlos per Klick.",

    /* Footer */
    footerTagline: "Vereins-Management für Rollkunstlauf — mit Herz für die Halle.",
    footerProduct: "Produkt",
    footerLegal: "Rechtliches",
    imprint: "Impressum",
    privacy: "Datenschutz",
    footerCopy: "© {year} RollsportManager · Alle Angaben ohne Gewähr",
  },
  en: {
    appName: "RollsportManager",
    skipToContent: "Skip to content",
    languageLabel: "Switch language",

    /* Topbar */
    navLabel: "Page sections",
    navFeatures: "Features",
    navPricing: "Pricing",
    navFaq: "FAQ",
    login: "Sign in",

    /* Hero */
    heroEyebrow: "Club software for artistic roller skating",
    heroTitle: "Schedules, routine music and fees — all in one place.",
    heroSub:
      "RollsportManager takes the paperwork off your club's plate: RSVPs in seconds, routine music with loop and tempo control right at the rink, and dunning with built-in approval. For the board, the coaching team and parents.",
    heroCtaPrimary: "Try it for free",
    heroCtaSecondary: "See the features",
    heroFreeNote: "Members & parents always free · cancel monthly",

    /* Hero preview (stylised app card) */
    previewClub: "RSV Neckarsulm · Overview",
    previewCountdown: "Next competition",
    previewDays: "{n} days",
    previewNextTraining: "Next practice",
    previewOpen: "Outstanding fees",
    previewOpenSub: "{n} invoices · auto-reminders on",
    previewRoutine: "Routine music",
    previewRoutineMeta: "{title} · {duration}",
    previewPlay: "Play routine (preview)",

    /* Feature 1 — Routine studio (USP) */
    f1Eyebrow: "Routine studio",
    f1Title: "Routine music belongs at the rink, not in a recording studio.",
    f1Body:
      "Upload the music, loop the tricky passage, slow the tempo for practice — the pitch stays put. The piece of music becomes a training plan.",
    f1Point1: "A–B loop with labelled handles — the jump combination runs until it sticks",
    f1Point2: "Tempo 50–100% without pitch change — at 85% “{title}” runs {slowed} instead of {normal}",
    f1Point3: "Time markers with RollArt codes (2S, SSp, StSq) — “play from here” for every element",
    f1InLoop: "in loop",
    f1WaveLabel: "Waveform of the routine “{title}” with A–B loop",

    /* Feature 2 — Events & attendance */
    f2Eyebrow: "Events & attendance",
    f2Title: "Who's coming to practice today? One question, answered instantly.",
    f2Body:
      "Parents accept or decline with one tap — including a reason. Coaches see at the rink who they can plan with, and tick off attendance on the spot.",
    f2Point1: "RSVPs with a single tap — easy even for parents new to apps",
    f2Point2: "Plain words instead of colour codes: “9 going · 1 declined · 4 open”",
    f2Point3: "Check-in list for practice — attendance done in under a minute",

    /* Feature 3 — Fees & dunning */
    f3Eyebrow: "Fees & dunning",
    f3Title: "Collect fees without chasing anyone.",
    f3Body:
      "Invoices, a cash book and dunning automation that starts friendly and never escalates over your head: from level 2 on, nothing is sent without approval.",
    f3Point1: "Automatic reminder after 7 days — friendly and in your club's name",
    f3Point2: "Four-step dunning ladder with clear words instead of alarm red over people",
    f3Point3: "Amounts consistent to the cent — from the tile to the totals row",
    f3Microcopy: "Level 2+ is never sent automatically — the board approves first.",
    f3InvoicesWord: "{n} items",

    /* Pricing */
    pricingEyebrow: "Pricing",
    pricingTitle: "One price per club. Done.",
    pricingSub: "No setup fee, no fixed term — you can cancel monthly.",
    alwaysFree: "Members & parents always free",
    perMonth: "per month per club",
    popular: "Popular",
    vatNote: "All prices plus VAT · 30-day free trial, no payment details",
    tierCta: "Try it for free",

    p1Name: "Club Basic",
    p1Price: "€29",
    p1Audience: "For small clubs up to 50 members",
    p1F1: "Events with RSVPs",
    p1F2: "Member and family management",
    p1F3: "Attendance via check-in list",
    p1F4: "German and English for everyone",

    p2Name: "Club Pro",
    p2Price: "€49",
    p2Audience: "For active clubs up to 200 members",
    p2F1: "Everything in Basic",
    p2F2: "Routine studio: loop, tempo, markers",
    p2F3: "Fees, invoices and cash book",
    p2F4: "Dunning automation with board approval",
    p2F5: "Manage SEPA mandates for membership fees",

    p3Name: "Club Premium",
    p3Price: "€79",
    p3Audience: "For large clubs — unlimited members",
    p3F1: "Everything in Pro",
    p3F2: "Competition planning and RollArt history",
    p3F3: "Bank reconciliation with match suggestions",
    p3F4: "Reports and GoBD-compliant export",
    p3F5: "Personal support with a call-back number",

    /* FAQ */
    faqEyebrow: "Frequently asked",
    faqTitle: "Before you convince the board",
    q1: "What do members and parents pay?",
    a1: "Nothing — promised. The club pays the plan price; all members, parents and coaches use the app for free. There are no per-head prices and no hidden extras.",
    q2: "How do we get our data out of Excel or our old software?",
    a2: "We help with the move personally and migrate the data together with you. To be honest: there is no ready-made CSV import for members, families and open fees yet. Bank statements can already be imported as CSV.",
    q3: "Where is our data stored, and what about privacy?",
    a3: "Every club sees only its own data — the separation is enforced in the database, not merely in the interface. Roles and permissions decide who sees what: a sick note, for example, is visible only to the family itself and to that child's coaching team, not to the whole club. Hosting, data processing agreements and data export are settled bindingly in the contract — we promise nothing here that we would not also put in writing.",
    q4: "Can we try it first?",
    a4: "Yes — 30 days for free, no payment details, with all Pro features. Afterwards you pick a plan or your access simply pauses. Cancellation is monthly, informally, with one click.",

    /* Footer */
    footerTagline: "Club management for artistic roller skating — with a heart for the rink.",
    footerProduct: "Product",
    footerLegal: "Legal",
    imprint: "Imprint",
    privacy: "Privacy",
    footerCopy: "© {year} RollsportManager · All information without guarantee",
  },
} satisfies Dict;
