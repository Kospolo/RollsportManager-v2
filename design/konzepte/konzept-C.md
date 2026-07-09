# Konzept C — „Heimspiel"
## Richtung: Warm & Vereinsnah

**RollsportManager v2 · Design-Konzept · Stand: 09.07.2026**
Mockup: `design/konzepte/konzept-C.html` (3 Screens, Light + Dark, selbstenthaltend)

---

## 1. Designphilosophie

**„Heimspiel"** ist das Gefühl, das dieses Design erzeugen soll: Man öffnet die App und ist *im eigenen Verein* — nicht in einer Verwaltungssoftware. Die Gestaltung leitet sich aus der realen Welt des Rollkunstlaufs ab: das warme Licht der Trainingshalle, das Cognac-Leder der Rollschuhe, das Beerenrot von Kürkleid und Medaillenband. Daraus entsteht Wärme, die **begründet** ist statt dekorativ — und deshalb nicht kindisch wirkt.

### Drei Leitprinzipien

**1. Menschen zuerst (Signatur des Konzepts).**
Jede Datenzeile beginnt mit einem Menschen. Anwesenheit ist kein Zahlenpaar, sondern ein Avatar-Stapel; ein offener Posten ist kein Rechnungsobjekt, sondern „Familie Grünewald, seit 42 Tagen". Initialen-Avatare bekommen deterministisch eine von sechs warmen Farben (pro Person stabil über alle Plattformen). Selbst das Kassenbuch führt jede Buchung mit einem Avatar bzw. Absender-Monogramm. Das ist die eine wiedererkennbare Idee, an der die Jury dieses Konzept festmachen soll.

**2. Wärme aus der Halle, nicht aus dem Farbtopf.**
Es gibt keine grauen Flächen und keine schwarze Tinte: Text ist Espresso-Braun, Flächen sind warmes Papier, Schatten sind braun getönt. Der Zweitakzent **Honig** ist reserviert für den Küren-/Audio-Kontext (Waveform, A–B-Loop, Zeitmarken) — er markiert den emotionalen Kern des Produkts und taucht sonst nirgends als Schmuck auf. Dark Mode ist kein invertiertes Blau-Grau, sondern das „Vereinsheim am Abend": tiefes Espresso mit denselben warmen Akzenten.

**3. Seriositätszonen.**
Freundlich heißt nicht verspielt. Im Finanzbereich gelten verschärfte Regeln: Tabellenziffern (`tabular-nums`), Beträge rechtsbündig, ruhige weiße Flächen, Eskalationsfarbe **nur am Stufen-Badge** — nie als eingefärbte Zeile, nie als Alarm-Rot über der Person. Eine 2. Mahnung ist im UI ein sachlicher Vorgang mit Freigabe-Hinweis („Stufe 2+ wird nie automatisch versendet"), kein Pranger. So bleibt das Konzept warm im Ton und präzise in der Sache.

### Niedrigschwelligkeit (ältere Vorstände, Eltern)

- **Touch-Ziele ≥ 44 px**, Listenzeilen ≥ 56 px, ein großer Primär-Button pro Karte.
- **Klartext statt Fachjargon**: „Wer noch offen ist" statt „Debitorenliste", „Jetzt erinnern" statt „Dunning-Prozess starten". Aktive Verben, durchgängig „du".
- **Eine Primäraktion pro Kontext** (Beere, Pill-Form) — alles andere ist sichtbar zweitrangig (Ghost/Soft).
- **Status nie nur über Farbe**: immer Farbe + Text (+ ggf. Icon), z. B. „9 Zusagen · 1 Absage · 4 offen".
- **Sprache DE/EN von Anfang an**, deutsche Strings immer mit echten Umlauten (ä/ö/ü/ß).

---

## 2. Farbpalette

### 2.1 Light Mode („Vormittag in der Halle")

| Token | Hex | Verwendung |
|---|---|---|
| `bg/canvas` | `#FBF4EC` | App-Hintergrund (warmes Papier) |
| `bg/surface` | `#FFFFFF` | Karten, Topbar, Sidebar |
| `bg/sunken` | `#F4E9DD` | Mulden: Suchfeld, Segmente, Zitate |
| `ink/primary` | `#35251C` | Text (Espresso statt Schwarz) — ~13:1 auf Surface |
| `ink/soft` | `#6B5648` | Sekundärtext — ~6,6:1 |
| `ink/faint` | `#8A7365` | Tertiär/Captions — ~4,8:1 |
| `line` | `#EBDCCE` | Hairlines, Karten-Ränder |
| `line/strong` | `#DCC9B8` | Ghost-Button-Ränder, Checkboxen |
| **`brand`** | **`#B23A5C`** | **Beere** — Primäraktionen, aktive Navigation, Links; Weiß darauf ~5,8:1 |
| `brand/strong` | `#9C2F4E` | Hover/Pressed |
| `brand/soft` | `#F7E3E9` | Aktiv-Hintergründe, Sekundär-Buttons |
| `brand/ink` | `#8E2946` | Text auf `brand/soft` |
| **`honey`** | **`#E8A94A`** | **Honig** — Waveform, Loop-Region, Kür-Chips (nur dekorativ) |
| `honey/deep` | `#97570E` | Honig als Text/Icons (Zeitmarken, Loop-Griffe) — ~5,7:1 |
| `honey/soft` | `#F9EDD8` | Honig-Tint-Flächen |
| `success` | `#3F7D4E` | Zusagen, bezahlt, „im Limit" — ~4,9:1 |
| `success/soft` | `#E4F0E3` | Erfolg-Tint |
| `warn` | `#97570E` | Fristen, Erinnerung/1. Mahnung |
| `warn/soft` | `#F9EDD8` | Warn-Tint |
| `danger` | `#BC3D30` | Absagen, überfällig, 2. Mahnung — ~5,5:1 |
| `danger/soft` | `#F9E4E0` | Danger-Tint |

### 2.2 Dark Mode („Vereinsheim am Abend")

| Token | Hex | Anmerkung |
|---|---|---|
| `bg/canvas` | `#241A14` | tiefes Espresso, kein Blau-Schwarz |
| `bg/surface` | `#2C211A` | Karten |
| `bg/sunken` | `#1C130E` | Mulden |
| `ink/primary` | `#F5EAE0` | ~13:1 auf Surface |
| `ink/soft` | `#C9B3A4` | |
| `ink/faint` | `#A18C7D` | |
| `line` | `#3E3129` / strong `#4E3E33` | |
| `brand` | `#E0698A` | aufgehellte Beere — ~4,9:1 auf Surface |
| `brand/strong` | `#EB7F9D` | Hover |
| `brand/soft` | `#46232E` · `brand/ink` `#F2A9BD` | |
| `brand/contrast` | `#2B0E17` | Text **auf** Beere-Buttons (statt Weiß) — ~5,6:1 |
| `honey` | `#E8A94A` · deep `#EFB55E` · soft `#3D2C15` | Waveform leuchtet warm |
| `success` | `#85C492` · soft `#24382A` | |
| `warn` | `#EFB55E` · soft `#3D2C15` | |
| `danger` | `#E88374` · soft `#43211B` | |

### 2.3 Avatar-Farbwelt (Signatur)

Sechs warme Töne, per Hash aus der Personen-ID gewählt (stabil über alle Plattformen). Text darauf: Weiß (Light) bzw. dunkles Espresso `rgba(26,13,8,.92)` (Dark, da die Töne aufgehellt werden).

| Token | Light | Dark |
|---|---|---|
| `av/berry` | `#B23A5C` | `#C1516F` |
| `av/coral` | `#C25B3F` | `#C96A4E` |
| `av/honey` | `#B4741C` | `#BB8028` |
| `av/moss` | `#4C8555` | `#5C9465` |
| `av/plum` | `#8A4E9C` | `#9A61AC` |
| `av/petrol` | `#3E7D83` | `#4E8D93` |

### 2.4 Farbregeln

1. **Beere = Handlung.** Genau eine Beere-Primäraktion pro Sichtbereich.
2. **Honig = Musik.** Ausschließlich im Küren-/Audio-Kontext (Waveform, Loop, Zeitmarken, Kür-Termin-Chips).
3. **Eskalation nur am Badge**: Offen (neutral) → Erinnerung (Honig) → 1. Mahnung (Warn) → 2. Mahnung (Danger). Nie ganze Zeilen einfärben.
4. **Semantik nie ohne Text** (Farbenblindheit): Jeder farbige Status trägt sein Wort.

---

## 3. Typografie

### 3.1 Schriften (frei verfügbar, self-hosted)

| Rolle | Produkt (Web/Android, Google Fonts, OFL) | iOS/macOS (System) | Charakter |
|---|---|---|---|
| **Display/Headlines** | **Bricolage Grotesque** (SemiBold 600, ExtraBold 800) | **SF Pro Rounded** (Bold/Heavy) | warm, charaktervoll, erwachsen-freundlich |
| **UI/Body** | **Plus Jakarta Sans** (400/600/700) | SF Pro Text | runde Terminals, sehr gut lesbar |
| **Zahlen/Zeiten (Mono)** | **JetBrains Mono** (500/700) | SF Mono | Kürzeiten (1:04), Loop-Marken, Kassenbuch |

Kein CDN — Fonts werden als `woff2` gebundlet (Web) bzw. in die App-Pakete eingebettet (Android). Das HTML-Mockup nutzt ersatzweise den System-Stack `ui-rounded → SF Pro Rounded` / System-Sans / `ui-monospace`, damit es ohne externe Ressourcen denselben Charakter zeigt.

### 3.2 Typo-Skala (Web px · iOS pt · Android sp ≈ 1:1)

| Token | Größe/Zeile | Gewicht | Verwendung |
|---|---|---|---|
| `display` | 27/32 | 800, ls −0.02em | Seiten-Begrüßung, Kür-Titel |
| `h2` | 20/26 | 800 | Sektionen |
| `h3` | 17/23 | 800 | Kartentitel |
| `body-strong` | 14.5/21 | 700 | Namen, Zeilen-Titel |
| `body` | 14.5/22 | 400 | Fließtext |
| `caption` | 12.5/17 | 400–600 | Metatexte |
| `eyebrow` | 11/14 | 800, VERSALIEN, ls +0.09em | Karten-Obertitel |
| `numeric` | kontextuell | 700 + `tabular-nums` | alle Beträge, Quoten, Zeiten |

### 3.3 Regeln

- Display-Schrift **nur** für Begrüßung, Karten-/Kür-Titel und große Kennzahlen — nie für Fließtext (verhindert „kindisch").
- **Beträge und Zeiten immer tabular** (`font-variant-numeric: tabular-nums` / `monospacedDigit()` / `FontFeature.tabularFigures()`).
- Versalien nur in Eyebrows und Tabellenköpfen.
- Deutsche UI-Strings immer mit echten Umlauten; DE und EN werden gleichzeitig gepflegt (ein String-Katalog, zwei Pflichtsprachen; FR/RU/TR als optionale Pakete wie in v1).

---

## 4. Spacing, Radius, Elevation

### 4.1 Spacing (4-pt-Basis)

`space-1..10` = **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64**

- Karten-Innenabstand: 20–24 · Karten-Gap: 22 · Seitenränder Desktop: 28–32
- Listenzeilen: min. 56 px Höhe · **alle interaktiven Ziele ≥ 44×44 px** (auch Desktop!)

### 4.2 Radius („freundliche Rundungen")

| Token | Wert | Verwendung |
|---|---|---|
| `radius-s` | 8 | Checkboxen, kbd, kleine Tags |
| `radius-m` | 12 | Inputs, Nav-Items, Zitat-Blasen |
| `radius-l` | 16 | Kacheln, KPI-Karten, Banner |
| `radius-xl` | 20 | Karten (Standard) |
| `radius-full` | 999 | Buttons, Chips, Suchfeld, Segmente, Avatare |

Pill-Buttons sind bewusster Teil der Identität; Seriosität entsteht über Farbe/Typo, nicht über Ecken.

### 4.3 Elevation & Fokus

- Schatten immer **warm getönt** (`rgba(84,49,29,…)`), zwei Stufen: `card` (0 1 2 / 0 10 30) und `pop` (Modals). Dark Mode: Ränder statt Schatten.
- Fokus: 3 px Ring in `brand`, Offset 2 px, auf allen Plattformen sichtbar (auch bei Maus+Tastatur-Mischbetrieb via `:focus-visible`).
- `prefers-reduced-motion` deaktiviert alle Transitionen; Animationen sind ohnehin sparsam (Hover-Tints, 0.98-Scale beim Drücken, Waveform-Playhead).

---

## 5. Komponenten-Prinzipien

1. **Avatar-first-Zeile** (Signatur): `[Avatar] [Name fett + Kontext-Caption] [Sachdaten] [Status-Chip] [Aktion]` — identisch aufgebaut in Anwesenheit, Offenen Posten, Kassenbuch, Chat.
2. **Karte = ein Job.** Jede Karte hat Eyebrow (Einordnung), Titel (Menschensprache) und höchstens eine Beere-Aktion. Sekundäres ist Ghost.
3. **Status-Chips**: Tint-Hintergrund + dunkler Text + Wort, nie nur Punkt/Farbe.
4. **Leere Zustände mit Handlung** (Lehre aus v1): immer Illustration/Icon + ein Satz + CTA („Noch keine Kür — Musik hochladen").
5. **Antworten mit Grund**: Absagen erscheinen als warme Zitat-Blase mit Avatar („Erkältung, morgen wieder dabei") — Community-Gefühl statt nackter Zahl; Antwortoptionen überall identisch (Zusage/Absage/Vielleicht/Krank + Kommentar).
6. **Audio-Player-Familie**: großes Play (68 px, Beere), ±5-s-Sprünge, Countdown als Segment (0/3/5/8 s), Tempo-Pills (50/75/85/100 %) + Slider mit Klartext-Folge („bei 85 % läuft die Kür 2:56"), A–B-Loop mit beschrifteten Honig-Griffen, Zeitmarken-Liste mit „ab hier abspielen". Tastatur: Leertaste/L/Pfeile.
7. **Finanz-Komponenten**: KPI-Karten mit Farbpunkt-Legende, Eskalations-Pipeline (4 Stufen mit Farbkante links), Tabellen mit `tabular-nums` und rechtsbündigen Beträgen, Automatisierungs-Banner mit Schalter + „Regeln bearbeiten" (Zero-Touch-Billing sichtbar, aber kontrollierbar).
8. **Rollen-Workspaces statt Feature-Sidebar**: max. 5 Top-Ziele pro Rolle (Trainer: Heute/Kalender/Gruppen/Küren/Wettkampf · Verwaltung: Übersicht/Mitglieder/Beiträge & Finanzen/Berichte). Globale ⌘K-Suche fängt alles Übrige.
9. **Fehler & Feedback**: Toast mit Klartext + Wiederholen-Aktion; nie stilles Scheitern (v1-Lehre); Optimistic UI bei Zu-/Absagen und Check-ins.

---

## 6. Übersetzung auf die Plattformen (Token-Architektur)

**Eine Quelle der Wahrheit**: `tokens.json` (W3C Design Tokens Format) im Repo, per Style Dictionary generiert nach:

| Ebene | Web (Next.js) | iOS/macOS/watchOS (SwiftUI) | Android (Compose) |
|---|---|---|---|
| Farben | CSS Custom Properties (`--brand`, `:root[data-theme]` + `prefers-color-scheme`) | Asset Catalog Color Sets (Any/Dark automatisch) + `enum RSMColor` | `RsmColorScheme` (Light/Dark `staticCompositionLocal`), Mapping auf Material 3 `ColorScheme` (primary=brand, surface, error=danger) |
| Typografie | `--font-display/body/mono` + Utility-Klassen | `Font.system(.title, design: .rounded)` etc., Dynamic-Type-fähig | `RsmTypography` mit gebundelten Fonts, `sp`-Skala |
| Radius/Spacing | px-Variablen | pt-Konstanten (`RSM.Radius.xl = 20`) | dp-Konstanten |
| Komponenten | React-Bibliothek (`<PersonRow>`, `<StatusChip>`, `<PlayerTransport>`) | SwiftUI-Komponenten gleichen Namens | Compose-Komponenten gleichen Namens |

**Plattform-Regeln:**
- **Dark Mode** folgt überall dem System, plus manueller Override in den Einstellungen (Web: `data-theme`-Attribut, iOS: `preferredColorScheme`, Android: `AppCompatDelegate`). Token-Werte sind identisch — kein Plattform-Drift.
- **iOS** nutzt SF Pro Rounded statt Bricolage (nativer, gleicher Charakter); Watch übernimmt nur `brand`, `ink`, Avatar-Farben und die Player-Transport-Ikonografie (Check-in + „nächster Termin" als Fokus-Features).
- **Android** hält Material-You-Dynamik **aus** (Vereinsidentität schlägt Systemfarbe), respektiert aber System-Schriftgrößen.
- **Avatare** überall aus derselben Hash-Funktion (personId → 1 von 6 Tönen), damit „Lina ist plum" auf jedem Gerät gilt.
- **Barrierefreiheit als Abnahmekriterium**: Kontraste wie in §2 (AA), Touch-Ziele ≥ 44, VoiceOver/TalkBack-Labels für Player (Waveform als Slider mit Wertansage), `reduced motion`, vollständige Tastaturbedienung im Web.

---

## 7. Was das Mockup zeigt (`konzept-C.html`)

| Screen | Inhalt | Konzept-Beweis |
|---|---|---|
| 01 Trainer-Dashboard | „Guten Morgen, Katrin!", 2 Einheiten mit Avatar-Anwesenheit + Absagegrund-Blase, Küren-Schnellzugriff, Aufgaben mit Fristen-Chips, „Unser Vereinsleben" (Geburtstag, Fotos, Kuchen-Slots) | Menschen zuerst, Wärme, max. 5 Nav-Ziele |
| 02 Kür-Detail | Waveform (Beere=gespielt, Honig-Loop mit A/B-Griffen), Countdown-Segment, Tempo-Pills+Slider, Markierungen mit RollArt-Kürzeln (2S, SSp, StSq), Notizen + Wertungshistorie | Honig=Musik, große Bedienziele, Nischen-Tiefe |
| 03 Finanzen | KPI-Zeile, Automatisierungs-Banner, Eskalations-Pipeline, Offene Posten (avatar-first), Kassenbuch mit Saldo | Seriositätszone: tabular, Badge-only-Eskalation |

Light + Dark umschaltbar (Hell/Auto/Dunkel, `prefers-color-scheme` + Toggle), komplett ohne externe Ressourcen, alle Beispieldaten deutsch mit echten Umlauten.
