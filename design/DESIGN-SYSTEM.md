# RollsportManager v2 — Design-System „Heimspiel“ (Final)

**Stand: 10.07.2026 · Basis: Wettbewerbssieger Konzept C „Heimspiel“ (Warm & Vereinsnah)**
Ergänzt um die Jury-Übernahmen aus Konzept A („Klar & Professionell“) und Konzept B („Momentum“) sowie die Behebung aller benannten Sieger-Schwächen.
Maschinenlesbare Tokens: `design/tokens.json` · Referenz-Mockup: `design/final/mockup-final.html`

---

## 0. Wettbewerbsentscheid (Kurzprotokoll)

Die Jury-Linsen ergaben ein Patt: Die **Nutzer-Linse** (ehrenamtlicher Vorstand 55+, gestresste Eltern, junge Trainerin) setzte **Heimspiel** auf Platz 1, die **Craft-/Umsetzungs-Linse** setzte **Klar & Professionell** auf Platz 1 (Momentum in beiden Linsen Platz 3). Laut Wettbewerbsregel entscheidet bei Patt die Nutzer-Linse: **Heimspiel gewinnt.** Der Craft-Vorsprung von A wird nicht verworfen, sondern gezielt eingebaut (Mono-Disziplin in Finanztabellen, Mahn-Automatik-Zeitleiste, Bankabgleich, Filter, klickbare Waveform).

---

## 1. Philosophie

**„Heimspiel“**: Man öffnet die App und ist *im eigenen Verein* — nicht in einer Verwaltungssoftware. Die Wärme ist aus der realen Domäne hergeleitet (Hallenlicht, Cognac-Leder der Rollschuhe, Beere von Kürkleid und Medaillenband) und deshalb begründet statt dekorativ.

### Vier Leitprinzipien

1. **Menschen zuerst (Signatur).** Jede Datenzeile beginnt mit einem Menschen: Avatar-Stapel statt Zahlenpaar, „Familie Grünewald, seit 42 Tagen“ statt Debitorenposten. Sechs warme Avatar-Töne, deterministisch per Hash aus der `personId` — auf jeder Plattform identisch. **Ausnahme (Jury-Fix):** Organisationen und Sammelbuchungen (Stadt, SEPA-Lauf, Vereinsfest) bekommen **Icon-Kacheln** (eckigere Rundung, `radius.org = 9`), keine erzwungenen Pseudo-Monogramme.
2. **Wärme aus der Halle, nicht aus dem Farbtopf.** Keine grauen Flächen, keine schwarze Tinte: Text ist Espresso, Flächen sind warmes Papier, Schatten sind braun getönt. Dark Mode ist das „Vereinsheim am Abend“ — tiefes Espresso, kein invertiertes Blau-Grau.
3. **Honig = Musik, ohne Ausnahme (Jury-Fix, präzisiert).** Der Zweitakzent Honig ist *exklusiv* für den Küren-/Audio-Kontext: gespielte Waveform, A–B-Loop, Zeitmarken, Kür-Chips. Er taucht **nie** im Mahnwesen oder als Schmuck auf. Die Mahnstufe „Erinnerung“ nutzt dafür den neuen semantischen Ton **Info (Petrol)** — damit bleibt die Eskalationstreppe vierstufig unterscheidbar (Neutral → Info → Warn → Danger) und die Signatur-Regel hält.
4. **Seriositätszonen (verschärft).** Freundlich heißt nicht verspielt. Im Finanzbereich gelten strengere Regeln: **weiße Flächen** (Surface, nie Canvas-Beige als Tabellengrund), **JetBrains Mono für alle Beträge und Rechnungsnummern** (Jury-Übernahme aus A), `tabular-nums`, rechtsbündige Beträge, echtes Minuszeichen (−), Eskalationsfarbe **nur am Stufen-Badge** — nie als eingefärbte Zeile. Display-Rounded bleibt den KPI-Zahlen vorbehalten.

### Niedrigschwelligkeit (nicht verhandelbar)

- Touch-Ziele **≥ 44 px** (auch Desktop), Listenzeilen **≥ 56 px**, Play-Button 68 px.
- Basisschrift **14,5 px**; `ink.faint` nie unter 12,5 px.
- **Klartext statt Fachjargon**: „Wer noch offen ist“ statt Debitorenliste, „Jetzt erinnern“ statt Dunning.
- **Status nie nur über Farbe**: immer Farbe + Wort (+ ggf. Icon): „9 Zusagen · 1 Absage · 4 offen“.
- **Kontroll-Mikrocopy** überall, wo das System automatisch handelt: „Stufe 2+ wird nie automatisch versendet — Freigabe durch den Vorstand“, „Vor jedem Versand siehst du die E-Mail pro Empfänger“.
- **Anrede konfigurierbar (Jury-Fix):** Du/Sie ist eine Vereinseinstellung. Der String-Katalog führt pro Sprache beide Register (`de.du`, `de.sie`; EN unverändert). Alle System-Mikrocopy wird in beiden Registern gepflegt. Standard: Du.
- **DE/EN gleichzeitig gepflegt** (ein Katalog, zwei Pflichtsprachen; FR/RU/TR als optionale Pakete wie v1). Deutsche Strings **immer mit echten Umlauten** (ä/ö/ü/ß). Der DE/EN-Sprachchip ist sichtbar in der Topbar.

---

## 2. Token-Referenz

### 2.1 Farben — Light („Vormittag in der Halle“)

| Token | Hex | Verwendung |
|---|---|---|
| `bg/canvas` | `#FBF4EC` | App-Hintergrund (warmes Papier) |
| `bg/surface` | `#FFFFFF` | Karten, Topbar, Sidebar; Pflicht in der Seriositätszone |
| `bg/sunken` | `#F4E9DD` | Mulden: Suchfeld, Segmente, Zitate |
| `ink/primary` | `#35251C` | Text (Espresso) — ~13:1 |
| `ink/soft` | `#6B5648` | Sekundärtext — ~6,6:1 |
| `ink/faint` | `#8A7365` | Tertiär/Captions — ~4,8:1 |
| `line` | `#EBDCCE` | Hairlines, Karten-Ränder |
| `line/strong` | `#DCC9B8` | Ghost-Ränder, Checkboxen |
| **`brand`** | **`#B23A5C`** | **Beere** — Primäraktionen, aktive Nav, Links (Weiß darauf ~5,8:1) |
| `brand/strong` | `#9C2F4E` | Hover/Pressed |
| `brand/soft` | `#F7E3E9` | Aktiv-Hintergründe, Sekundär-Buttons |
| `brand/ink` | `#8E2946` | Text auf `brand/soft` |
| `brand/contrast` | `#FFFFFF` | Text auf `brand` |
| **`honey`** | **`#E8A94A`** | **Nur Musik**: gespielte Waveform, Loop-Region, Kür-Chips |
| `honey/deep` | `#97570E` | Honig als Text/Icon (Zeitmarken, Loop-Griffe) — ~5,7:1 |
| `honey/soft` | `#F9EDD8` | Honig-Tint |
| **`info`** | **`#2F6B72`** | **NEU**: Mahnstufe „Erinnerung“, neutrale Systemhinweise |
| `info/soft` | `#E2EFEF` | Info-Tint |
| `success` | `#3F7D4E` | Zusagen, bezahlt, im Limit — ~4,9:1 |
| `success/soft` | `#E4F0E3` | |
| `warn` | `#97570E` | Fristen, 1. Mahnung |
| `warn/soft` | `#F9EDD8` | |
| `danger` | `#BC3D30` | Absagen, überfällig, 2. Mahnung — ~5,5:1 |
| `danger/soft` | `#F9E4E0` | |
| `wave/off` | `#E9D6C2` | ungespielte Waveform |
| `focus` | `#B23A5C` | 3-px-Fokusring, Offset 2 px |

### 2.2 Farben — Dark („Vereinsheim am Abend“)

| Token | Hex | Anmerkung |
|---|---|---|
| `bg/canvas` | `#241A14` | tiefes Espresso, kein Blau-Schwarz |
| `bg/surface` | `#2C211A` | |
| `bg/sunken` | `#1C130E` | |
| `ink/primary` | `#F5EAE0` | ~13:1 |
| `ink/soft` | `#C9B3A4` | |
| `ink/faint` | `#A18C7D` | |
| `line` / `line/strong` | `#3E3129` / `#4E3E33` | Dark: Ränder statt Schatten |
| `brand` | `#E0698A` | aufgehellte Beere — ~4,9:1 |
| `brand/strong` | `#EB7F9D` | |
| `brand/soft` / `brand/ink` | `#46232E` / `#F2A9BD` | |
| **`brand/contrast`** | **`#2B0E17`** | **dunkler** Text auf Beere-Buttons statt Weiß — ~5,6:1 (Signatur-Technik) |
| `honey` / `honey/deep` / `honey/soft` | `#E8A94A` / `#EFB55E` / `#3D2C15` | Waveform leuchtet warm |
| `info` / `info/soft` | `#7FBFC6` / `#1E3538` | |
| `success` / soft | `#85C492` / `#24382A` | |
| `warn` / soft | `#EFB55E` / `#3D2C15` | |
| `danger` / soft | `#E88374` / `#43211B` | |
| `wave/off` | `#4A382C` | |
| `focus` | `#E0698A` | |

### 2.3 Avatar-Farbwelt (Signatur)

Hash aus `personId` → einer von sechs Tönen, stabil über alle Plattformen („Lina ist plum — überall“).

| Token | Light | Dark | Initialen-Farbe Light | Initialen-Farbe Dark |
|---|---|---|---|---|
| `av/berry` | `#B23A5C` | `#C1516F` | Weiß | `rgba(26,13,8,.92)` |
| `av/coral` | `#C25B3F` | `#C96A4E` | Weiß | dunkel |
| `av/honey` | `#B4741C` | `#BB8028` | **dunkel** (Jury-Fix: Weiß < AA) | dunkel |
| `av/moss` | `#4C8555` | `#5C9465` | **dunkel** (Jury-Fix) | dunkel |
| `av/plum` | `#8A4E9C` | `#9A61AC` | Weiß | dunkel |
| `av/petrol` | `#3E7D83` | `#4E8D93` | Weiß | dunkel |

**Organisationen** (Stadt, Verband, SEPA-Lauf, Veranstaltung): keine Monogramme, sondern Icon-Kachel `radius.org = 9 px`, Fläche `bg/sunken` (bzw. Semantik-Tint), Icon in `ink/soft`.

### 2.4 Typografie

| Rolle | Web/Android (self-hosted woff2, OFL) | iOS/macOS | Einsatz |
|---|---|---|---|
| Display | **Bricolage Grotesque** 600/800 | SF Pro Rounded | Begrüßung, Karten-/Kür-Titel, KPI-Zahlen — nie Fließtext |
| UI/Body | **Plus Jakarta Sans** 400/600/700 | SF Pro Text | alles andere |
| Mono | **JetBrains Mono** 500/700 | SF Mono | Kürzeiten, Loop-Marken, **alle Beträge + Rechnungsnummern in Tabellen** |

Kein CDN — Fonts werden gebundlet. Achtung (Jury-Hinweis): Der `ui-rounded`-Fallback degradiert außerhalb von Apple-Systemen; auf Web/Android ist Bricolage deshalb **Pflicht-Bundle**, kein Nice-to-have.

**Skala** (Web px · iOS pt · Android sp ≈ 1:1):

| Token | Größe/Zeile | Gewicht | Verwendung |
|---|---|---|---|
| `display` | 27/32 | 800, ls −0.02em | Seiten-Begrüßung, Kür-Titel |
| `h2` | 20/26 | 800 | Sektionen |
| `h3` | 17/23 | 800 | Kartentitel |
| `body-strong` | 14.5/21 | 700 | Namen, Zeilen-Titel |
| `body` | 14.5/22 | 400 | Fließtext |
| `caption` | 12.5/17 | 400–600 | Metatexte |
| `eyebrow` | 11/14 | 800, VERSALIEN, ls +0.09em | Karten-Obertitel |
| `mono-table` | 13/18 | 600 | Beträge, Rechnungsnummern, Salden |

Regeln: Beträge/Zeiten **immer tabular** (`tabular-nums` / `monospacedDigit()` / `FontFeature.tabularFigures()`); echtes Minuszeichen (−680,00 €); schmales Leerzeichen vor € und %; Versalien nur in Eyebrows und Tabellenköpfen.

### 2.5 Spacing (4-pt-Basis)

`space-1..10` = **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64**
Karten-Padding 20–24 · Karten-Gap 22 · Seitenränder Desktop 28–32 · Listenzeilen ≥ 56 px · interaktive Ziele ≥ 44×44 px.

### 2.6 Radius

| Token | Wert | Verwendung |
|---|---|---|
| `radius-s` | 8 | Checkboxen, kbd, kleine Tags |
| `radius-m` | 12 | Inputs, Nav-Items, Zitat-Blasen |
| `radius-l` | 16 | Kacheln, KPI-Karten, Banner |
| `radius-xl` | 20 | Karten (Standard) |
| `radius-org` | 9 | Icon-Kacheln für Organisationen |
| `radius-full` | 999 | Buttons, Chips, Suchfeld, Segmente, Personen-Avatare |

### 2.7 Schatten & Fokus

- `shadow/card` Light: `0 1 2 rgba(84,49,29,.05), 0 10 30 rgba(84,49,29,.07)` (warm getönt) · Dark: schwarz, dazu Ränder statt Tiefe.
- `shadow/pop` für Modals/Popover.
- Fokus: **3 px Ring** in `brand`, Offset 2 px, `:focus-visible` auf allen interaktiven Elementen.

### 2.8 Motion

- `fast` 150 ms ease-out (Hover, Chips) · `standard` 250 ms `cubic-bezier(.2,.8,.3,1)` (Panels) · Druck: scale 0.98.
- **Keine Dauer-Animationen** (Lehre aus Momentum: kein permanenter Glanzlauf). Bewegung nur auf Nutzeranlass — einzige Ausnahme: der Waveform-Playhead während der Wiedergabe.
- `prefers-reduced-motion` ist Killswitch für alles.

---

## 3. Komponenten-Katalog

### 3.1 Buttons

| Variante | Fläche/Text | Einsatz |
|---|---|---|
| **Primary** | `brand` / `brand-contrast` (Light: Weiß, **Dark: dunkles `#2B0E17`**) | genau **eine** pro Sichtbereich („Beere = Handlung“) |
| Secondary | `brand-soft` / `brand-ink` | naheliegende Zweitaktion |
| Ghost | Surface + `line-strong`-Rand / `ink` | alles Übrige |
| Größen | Standard min-height 44, `sm` 36 (nur in Tabellenzeilen/Karten-Köpfen) | Pill-Form (`radius-full`) ist Identität |

Zustände: Hover = `brand-strong` bzw. Sunken-Tint · Active = scale 0.98 · Fokus = 3-px-Ring · Disabled = 45 % Opazität, kein Hover.

### 3.2 Karten

`bg/surface`, Rand `line`, `radius-xl` 20, Padding 20–24, `shadow/card`. Struktur: **Eyebrow** (Einordnung) → **H3-Titel** (Menschensprache) → Inhalt → max. **eine** Beere-Aktion. Kacheln in Karten: `radius-l` 16 auf `bg/canvas`.

### 3.3 Tabellen (Seriositätszone)

- Kopf: Eyebrow-Stil (11 px, Versalien), Hairline darunter.
- Zeilen ≥ 56 px, Trennung nur per Hairline, **nie Zebra, nie eingefärbte Zeilen**.
- Personen-Zelle = Avatar-first (`[Avatar] [Name fett] [Kontext-Caption]`), Organisationen = Icon-Kachel.
- **Beträge: JetBrains Mono 13/600, `tabular-nums`, rechtsbündig, echtes −**; Rechnungsnummern ebenfalls Mono (`R-2026-0087`).
- **Filter-Chips über der Tabelle** (aus A): `Alle · Offen · Erinnert · Gemahnt` — Pill-Chips, aktiver Chip `brand-soft`/`brand-ink`; Filtern aktualisiert die **Summenzeile im Footer** (angezeigte Posten + Summe + Gesamtwert).
- Zeilen-Aktionen als Ghost-`sm`-Buttons, Überlauf im ···-Menü.
- Kassenbuch führt fortlaufenden Saldo (Mono, `ink/faint`); Beleg-Hinweis + GoBD-Export im Footer.

### 3.4 Formulare & Steuerelemente

- **Input/Suchfeld**: `bg/sunken`, `radius-m`/`full`, min-height 42–44, Placeholder `ink/faint`.
- **Switch**: 46×27, An = `success`; immer mit Wortlabel („Aktiv“).
- **Segment** (Countdown, Hell/Auto/Dunkel): Pill-Gruppe auf `bg/sunken`, aktives Segment Surface + Schatten.
- **Checkbox**: 23 px, `radius-s`, erledigt = `success`-Füllung + Häkchen + Durchstreichung.
- **Slider**: `accent-color: brand`; bei Tempo bidirektional mit Preset-Pills synchron (s. Player).
- Fehlertexte in Klartext unter dem Feld, `danger`, nie nur roter Rand.

### 3.5 Navigation

- **Rollen-Workspaces statt Feature-Sidebar**: max. 5 Top-Ziele pro Rolle (Trainer: Heute/Kalender/Gruppen/Küren/Wettkampf · Verwaltung: Übersicht/Mitglieder/Beiträge & Finanzen/Berichte). Gasttrainer sehen eine reduzierte Trainer-Sidebar (nur zugewiesene Gruppen, mit Ablaufdatum-Chip).
- Nav-Item: 44 px, `radius-m`; aktiv = `brand-soft`/`brand-ink`; Zähler-Badge = `brand`-Pill.
- Topbar: ⌘K-Suche (Sunken-Pill) · **DE/EN-Sprachchip sichtbar** · Benachrichtigungs-Glocke mit Punkt · Nutzer-Avatar.
- Breadcrumbs auf Detailseiten; User-Card unten in der Sidebar.
- **Vereinsleben-Karte** (Geburtstage, Fotos, Kuchen-Slots) lebt im **Mitglieder-/Eltern-Workspace** — nicht im Trainer-Dashboard (Jury-Fix: am Hallenrand ist sie Ablenkung).

### 3.6 Chips, Badges & Mahnstufen-Ampel

Ein Chip-System, Tint-Hintergrund + dunkler Text + **immer ein Wort**:
`neutral` (Sunken/`ink-soft`) · `brand` · `success` · `warn` · `danger` · `info` (Petrol) · `honey` (nur Musik).

**Mahnstufen-Ampel (vierstufige Treppe, jede Stufe eigener Farbton):**

| Stufe | Chip | Farbe |
|---|---|---|
| Offen | `chip-neutral` | Espresso auf Sunken |
| Erinnerung | `chip-info` | Petrol (**nicht** Honig — Honig gehört der Musik) |
| 1. Mahnung | `chip-warn` | Amber |
| 2. Mahnung / Übergabe | `chip-danger` | Rot |

Eskalationsfarbe **nur am Badge** und an der 4-px-Kante der Stufen-Kacheln — nie ganze Zeilen, nie über der Person.

### 3.7 Mahn-Automatik-Karte (aus A) & Bankabgleich (aus A)

- **Mahn-Automatik**: Karte mit Schalter („Aktiv“) und expliziter Regel-Zeitleiste als vier Kacheln: **+7 Tage** freundliche Erinnerung (automatisch) → **+21 Tage** 1. Mahnung (automatisch, mit Vorschau) → **+35 Tage** 2. Mahnung (**nur mit manueller Freigabe**) → **+49 Tage** Übergabe-Vorschlag an den Vorstand (nur manuell). Darunter die Kontroll-Mikrocopy des Siegers: „Stufe 2+ wird nie automatisch versendet — Freigabe durch den Vorstand.“ / „Vor jedem Versand siehst du die E-Mail pro Empfänger.“
- **Bankabgleich-Karte**: eigenes Dashboard-Element im Finanz-Workspace: „Automatisch zugeordnet: **31 von 34** Umsätzen“ + Fortschrittsbalken (`success`) + Primär-Ghost „3 Vorschläge prüfen“.
- **Eskalations-Pipeline**: 4 Stufen-Kacheln mit **Anzahl + Summe pro Stufe** (aus B), Farbkante links, Summen konsistent mit den KPI-Karten (Pflicht-Abnahmekriterium: die Zahlen müssen quer über den Screen aufgehen).

### 3.8 Audio-Player (Signature-Komponente)

- **Waveform**: Honig = Musik. Gespielter Teil `honey`, ungespielter `wave/off`, Playhead `ink`. **Klickbar zum Springen** (aus A) — Web zusätzlich als Slider mit Wertansage für Screenreader (`role="slider"`, aria-valuetext „1:04 von 2:30“).
- **A–B-Loop**: Honig-Region mit beschrifteten A/B-Griffen (Mono-Timecodes mit Dezimalkomma: `A 0:38,2`), Toggle mit `aria-pressed` und Wortlabel aktiv/aus.
- **Marker „im Loop“** (aus A): Zeitmarken, deren Position in der aktiven A–B-Schleife liegt, tragen einen Honig-Chip „im Loop“.
- **Transport**: Play 68 px (Beere), ±5-s-Sprünge 48 px, Countdown-Segment (Aus/3/5/8 s).
- **Tempo (aus B)**: Preset-Pills 50/75/85/100 % **plus Feinregler 0,5–2,0×**, bidirektional synchron (Pill ↔ Slider ↔ Anzeige). Immer mit **Klartext-Folge**: „bei 85 % läuft die Kür 2:56 statt 2:30 · Tonhöhe bleibt erhalten“.
- **Tastatur sichtbar dokumentiert**: `Leertaste` Start/Stopp · `L` Loop · `←`/`→` 5 s.
- **Zeitmarken-Liste**: Mono-Zeit-Badge (Honig), Elementname + RollArt-Kürzel-Chip (2S, SSp, StSq), „ab hier abspielen“-Button je Zeile.

### 3.9 RollArt-Verlauf (aus B) & Wettkampf-Countdown (aus B)

- **Score-Historie**: Verlaufs-Visualisierung über mehrere Wettkämpfe (z. B. 40,55 → 42,80 → 44,10) als warme Balken mit Mono-Werten und Delta-Chips (`success` bei Verbesserung) — der Trend ist der motivierende Wert, nicht die Einzelzahl.
- **Countdown-Hero**: dosiert eingesetzte Motivationskarte im Trainer-Dashboard („**9 Tage** bis zur Bezirksmeisterschaft“) — in Heimspiel-Tonalität: `brand-soft`-Tint, Display-Zahl, Klartext-Meta, **kein** Broadcast-Gradient, keine Animation.

### 3.10 Anwesenheit & Antworten

- **Avatar-Stack** + Klartext-Zeile („9 Zusagen · 1 Absage · 4 offen“) + **gestapelter Response-Balken** (aus B): 6 px, Segmente `success`/`danger`/`line-strong`, rein visuell (`aria-hidden`, der Text trägt die Information).
- **Absagegrund-Blase**: warme Zitat-Blase mit Avatar („Erkältung, morgen wieder dabei“) + Antworten-Link. Antwortoptionen überall identisch: Zusage/Absage/Vielleicht/Krank + Kommentar.
- Leere Zustände immer mit Handlung: Icon + ein Satz + CTA („Noch keine Kür — Musik hochladen“).
- Fehler: Toast mit Klartext + Wiederholen; nie stilles Scheitern. Optimistic UI bei Zu-/Absagen und Check-ins.

### 3.11 Theme-Schalter

Dreistufig **Hell/Auto/Dunkel** mit Persistenz (Web: `localStorage` + `data-theme`-Attribut, `color-scheme` gesetzt; iOS: `preferredColorScheme`; Android: `AppCompatDelegate`). Auto folgt dem System und bleibt nach Reload erhalten.

---

## 4. Do / Don’t

**Do**
- Genau eine Beere-Primäraktion pro Sichtbereich; alles andere Ghost/Soft.
- Jeder farbige Status trägt sein Wort (Farbenblindheit).
- Beträge: Mono, tabular, rechtsbündig, echtes −, schmales Leerzeichen vor €/%.
- Jede Automatik zeigt ihre Regeln und ihren Freigabepunkt im UI.
- Avatar-Töne nur aus dem 6er-Set, per Hash — nie manuell zugewiesen.
- Wochentage und Summen in UI-Texten rechnerisch prüfen (Abnahmekriterium — Lehre aus Momentum).
- Beide Sprachregister (Du/Sie) und beide Sprachen (DE/EN) bei jedem neuen String.

**Don’t**
- Honig außerhalb des Musik-Kontexts (auch nicht „nur als Tint“ im Mahnwesen).
- Weiße Initialen auf `av/honey`/`av/moss` im Light Mode.
- Weißer Text auf Dark-Mode-Beere (immer `brand/contrast`).
- Ganze Tabellenzeilen einfärben oder Alarm-Rot über Personen legen.
- Display-Schrift im Fließtext oder in Geld-Tabellenzellen.
- Dauer-Animationen, Gradient-Buttons mit Glow, kondensierte Riesenziffern für Geldbeträge.
- Pseudo-Monogramme für Organisationen („SN“ für Stadt Neckarsulm).
- Vereinsleben-Inhalte im Trainer-Dashboard „Heute“.
- ae/oe/ue/ss in deutschen UI-Strings.

---

## 5. Token-Übersetzung: Tailwind / SwiftUI / Compose

Quelle der Wahrheit: `design/tokens.json` (Style-Dictionary-Build in alle drei Ziele; Werte identisch, kein Plattform-Drift).

### 5.1 Farben

| Token | Tailwind (CSS-Var-basiert) | SwiftUI | Compose |
|---|---|---|---|
| `color.light/dark.bg.canvas` | `bg-canvas` → `var(--bg-canvas)` | `Color.rsmCanvas` (Asset „Canvas“, Any/Dark) | `RsmTheme.colors.canvas` |
| `bg.surface` | `bg-surface` | `Color.rsmSurface` | `colors.surface` |
| `bg.sunken` | `bg-sunken` | `Color.rsmSunken` | `colors.sunken` |
| `ink.primary/soft/faint` | `text-ink`, `text-ink-soft`, `text-ink-faint` | `Color.rsmInk`, `.rsmInkSoft`, `.rsmInkFaint` | `colors.ink`, `inkSoft`, `inkFaint` |
| `line`, `line.strong` | `border-line`, `border-line-strong` | `Color.rsmLine(.strong)` | `colors.line`, `lineStrong` |
| `brand.*` | `bg-brand`, `bg-brand-soft`, `text-brand-ink`, `text-brand-contrast` | `Color.rsmBrand`, `.rsmBrandSoft`, `.rsmBrandInk`, `.rsmBrandContrast` | `colors.brand`, `brandSoft`, `brandInk`, `brandContrast` |
| `honey.*` | `bg-honey`, `text-honey-deep`, `bg-honey-soft` | `Color.rsmHoney*` | `colors.honey*` |
| `info/success/warn/danger` (+`-soft`) | `text-info`, `bg-info-soft` usw. | `Color.rsmInfo` … | `colors.info` …; Material-3-Mapping: `primary=brand`, `surface=surface`, `error=danger` |
| `avatar.*` | `bg-av-berry` … `bg-av-petrol` | `RSMAvatarTone(rawValue: hash % 6)` | `RsmAvatarTone.entries[hash % 6]` |

Web: `:root` trägt Light-Werte, `[data-theme="dark"]` + `@media (prefers-color-scheme: dark)` die Dark-Werte; Tailwind-Farben zeigen ausschließlich auf CSS-Variablen (nie Hex im Utility). iOS: Color-Sets mit Any/Dark. Android: zwei statische `RsmColorScheme`-Instanzen, Material You **aus**.

### 5.2 Typografie

| Token | Tailwind | SwiftUI | Compose |
|---|---|---|---|
| `font.family.display` | `font-display` | `Font.system(size:, design: .rounded)` | `FontFamily(bricolage)` |
| `font.family.body` | `font-body` | `.body` (SF Pro Text) | `FontFamily(plusJakartaSans)` |
| `font.family.mono` | `font-mono` | `Font.system(.body, design: .monospaced)` / SF Mono | `FontFamily(jetbrainsMono)` |
| `display` 27/800 | `text-[27px] leading-8 font-extrabold tracking-tight font-display` | `RSMFont.display` | `RsmTypography.display` |
| `h3` 17/800 | `text-[17px] font-extrabold font-display` | `RSMFont.h3` | `typography.h3` |
| `body` 14.5 | `text-[14.5px] leading-[22px]` | `RSMFont.body` | `typography.body` |
| `eyebrow` | `text-[11px] font-extrabold uppercase tracking-[.09em]` | `RSMFont.eyebrow` | `typography.eyebrow` |
| tabular | `tabular-nums` | `.monospacedDigit()` | `FontFeature.tabularFigures()` |

### 5.3 Spacing / Radius / Größen

| Token | Tailwind | SwiftUI | Compose |
|---|---|---|---|
| `space.1..10` (4…64) | Standard-Skala `p-1=4px` … via Theme-Extension | `RSM.Space.s1 … s10` (pt) | `RsmSpace.s1 … s10` (dp) |
| `radius.s/m/l/xl/org/full` | `rounded-lg(8)`, `rounded-xl(12)`, `rounded-2xl(16)`, `rounded-[20px]`, `rounded-[9px]`, `rounded-full` | `RSM.Radius.s=8 … xl=20, org=9` | `RsmRadius.*` + `RoundedCornerShape` |
| `size.touchTarget` 44 | `min-h-11` | `.frame(minHeight: 44)` | `Modifier.sizeIn(minHeight = 44.dp)` |
| `size.listRow` 56 | `min-h-14` | 56 pt | 56.dp |
| `shadow.card` | `shadow-card` (Custom) | `.shadow(RSM.Shadow.card)` | `Elevation` aus + eigener Ambient-Shadow |
| `motion.fast/standard` | `duration-150 ease-out` / `duration-[250ms] ease-rsm` | `.animation(.easeOut(duration: .15))` | `tween(150, FastOutSlowIn)` |

**Komponenten-Parität**: `<PersonRow>`, `<OrgRow>`, `<StatusChip>`, `<EscalationBadge>`, `<PlayerTransport>`, `<WaveformSlider>`, `<TempoControl>`, `<ResponseBar>`, `<CountdownHero>`, `<ScoreTrend>` existieren namensgleich als React-, SwiftUI- und Compose-Komponenten. Watch übernimmt nur `brand`, `ink`, Avatar-Töne und die Player-Transport-Ikonografie (Check-in + nächster Termin).

---

## 6. Barrierefreiheit (Abnahmekriterien)

1. Kontraste gemäß §2 (AA für Text; Dark-Beere-Buttons via `brand/contrast` gelöst).
2. Touch-Ziele ≥ 44 px, Listenzeilen ≥ 56 px — auch Desktop.
3. Status nie nur über Farbe; jede Automatik hat sichtbare Regeln + Freigabepunkt.
4. Player: Waveform als Slider mit Wertansage, alle Icon-Buttons mit `aria-label`, Loop-Toggle mit `aria-pressed`, sichtbare Tastatur-Hinweise, vollständige Tastaturbedienung im Web.
5. `prefers-reduced-motion` deaktiviert alle Animationen (inkl. Playhead-Smoothing).
6. Sachliche Korrektheit ist Teil der A11y-Abnahme: Wochentage, Summen und Salden werden vor Release rechnerisch geprüft.
