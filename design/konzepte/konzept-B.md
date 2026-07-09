# Konzept B — „Momentum" (Sportlich & Dynamisch)

**Projekt:** RollsportManager v2 · **Richtung:** B — Sportlich & Dynamisch
**Autor:** Design-Wettbewerb, Konzept B · **Datum:** 09.07.2026
**Mockup:** `konzept-B.html` (selbstenthaltend, Light + Dark, 3 Screens)

---

## 1. Designphilosophie

### Leitidee: Schwung statt Verwaltung

Rollkunstlauf ist Geschwindigkeit, Eleganz und Präzision auf acht Rollen. „Momentum" überträgt genau diese drei Qualitäten in die Oberfläche:

1. **Geschwindigkeit** → Große, kondensierte Zahlen (Display-Typo), die man aus zwei Metern Entfernung in der Halle liest. Sofort erfassbare KPI-Karten statt Textwüsten. Der Trainer steht am Hallenrand, nicht am Schreibtisch.
2. **Eleganz** → Ruhige Flächen, viel Weißraum, Karten mit weicher, geschichteter Tiefe. Die Energie kommt aus wenigen, gezielten Akzenten — nicht aus Buntheit. Eine Finanz-Tabelle bleibt eine seriöse Finanz-Tabelle.
3. **Präzision** → Tabellarische Ziffern überall wo Geld oder Zeit steht, Mono-Font für IBAN/Belegnummern/Timecodes, klare Statusfarben mit Icon + Label (nie Farbe allein).

**Zielgefühl:** „Das ist *meine Sport-App*" — beim Öffnen des Trainer-Dashboards fühlt es sich an wie die Startaufstellung vor dem Lauf, nicht wie ein Behördenformular. Gleichzeitig trägt dasselbe System eine Mahnstufen-Pipeline und ein Kassenbuch, ohne albern zu wirken.

### Die drei Gestaltungsprinzipien

**P1 — Eine Akzentfarbe führt, Domänenfarben ordnen.**
„Flame" (Signal-Orangerot) ist die einzige Marken-Akzentfarbe: primäre Aktionen, aktive Navigation, Fortschritt, Live-Zustände. Drei sekundäre Domänenfarben codieren wiederkehrende Inhaltstypen: **Violett = Küren/Kreatives**, **Ice-Teal = Training/Anwesenheit**, **semantisches Grün/Amber/Rot = Finanzen/Status**. So bleibt das Interface lesbar, obwohl es energisch ist. Wichtig: Gefahr/Überfällig ist ein *kühles* Karmesinrot (`#C81E3C`), deutlich getrennt vom warmen Marken-Orangerot — Mahnwesen und Branding kollidieren nie.

**P2 — Zahlen sind Helden.**
Statistiken, Beträge, Countdowns und Zeiten werden in der kondensierten Display-Schrift groß gesetzt (28–56 px). Alles andere (Labels, Fließtext, Formulare) bleibt bewusst zurückhaltend. Das erzeugt den „Sport-Broadcast-Look" (Anzeigetafel, Startliste, Scoring) mit einem einzigen Mittel — ohne Deko.

**P3 — Bewegung als Andeutung, nie als Show.**
Motion kommuniziert Zustand: Karten heben sich 2 px beim Hover, der Live-Punkt pulsiert, die Waveform „atmet" beim Abspielen, Fortschrittsbalken haben einen dezenten Glanzlauf. Alle Animationen ≤ 250 ms, `prefers-reduced-motion` schaltet alles ab. Keine Parallax-Spielereien, keine Dauer-Animationen in Finanz-Ansichten.

### Was dieses Konzept aus der Studie ableitet

- **Rollenbasierte Workspaces** (UX-Report §6.2): Die Sidebar zeigt max. 6 Ziele pro Rolle („Training" für Trainer, „Verwaltung" für Admin/Kassenwart) statt 40+ Links. Das Mockup zeigt beide Workspaces.
- **Küren-Modul als Bühne** (Markt-Report §3.4): Der Audio-Player ist das am sorgfältigsten gestaltete Einzelstück — Waveform, A-B-Loop, Tempo und Countdown sind Erstklass-Bedienelemente, kein verstecktes Sheet.
- **Finanz-Workflow statt Finanz-Seiten** (UX-Report §6.7): Die Mahnstufen als visuelle Pipeline (offen → erinnert → gemahnt → bezahlt) mit Automatik-Regeln sichtbar im UI.
- **Empty States immer mit CTA, Fehler nie still** (UX-Report §6.10): Komponenten-Prinzip, siehe §6.

---

## 2. Farbpalette

### 2.1 Marken- & Domänenfarben

| Token | Light | Dark | Verwendung |
|---|---|---|---|
| `flame` | `#F04E23` | `#FF6A3D` | Primäraktion, aktive Nav, Fortschritt, Live |
| `flame-strong` | `#C93A10` | `#FF8A64` | Text/Icons auf hellem Grund (AA), Hover |
| `flame-soft` | `#FDEBE4` | `#3A1D12` | Hinterlegungen, Badges |
| `flame-grad` | `linear-gradient(135deg, #FF7A45 → #E63317)` | `linear-gradient(135deg, #FF8A5C → #F2461F)` | Primär-Buttons, Hero-Akzente, aktiver Nav-Punkt |
| `violet` (Küren) | `#6C4CF1` | `#9B8AFF` | Kür-Status, A-B-Loop, Kreativ-Inhalte |
| `violet-soft` | `#EFEBFE` | `#272045` | Kür-Badges, Loop-Bereich |
| `ice` (Training) | `#0E8F84` | `#2BD4C4` | Anwesenheit, Check-in, Trainingskontext |
| `ice-soft` | `#E0F4F1` | `#0F332E` | Hinterlegungen |

### 2.2 Semantische Farben (Finanzen & Status)

| Token | Light | Dark | Verwendung |
|---|---|---|---|
| `success` | `#178A50` | `#42D882` | Bezahlt, Zusage, positiv |
| `success-soft` | `#E2F4EA` | `#0E2C1C` | Badges/Zellen |
| `warning` | `#9A6200` | `#FFC24B` | Offen, Erinnerung, „Vielleicht" |
| `warning-soft` | `#FBF0DA` | `#332405` | Badges/Zellen |
| `danger` | `#C81E3C` | `#FF5C7A` | Überfällig, Mahnung, Absage |
| `danger-soft` | `#FAE5EA` | `#38121D` | Badges/Zellen |

### 2.3 Neutrale Flächen & Text

| Token | Light | Dark | Verwendung |
|---|---|---|---|
| `bg-page` | `#EEF0F4` | `#0B0D12` | Seitenhintergrund |
| `bg-card` | `#FFFFFF` | `#151823` | Karten |
| `bg-raised` | `#F7F8FA` | `#1C202E` | Erhöhte Elemente in Karten, Hover-Zeilen |
| `bg-inset` | `#E9EBF0` | `#10131B` | Eingelassene Flächen (Player-Bett, Inputs) |
| `line` | `#E2E5EB` | `#252A39` | Hairlines, Tabellen-Trenner |
| `line-strong` | `#C9CFDA` | `#343B4F` | Umrandungen, Fokus-Basis |
| `text` | `#161A24` | `#F2F4F8` | Primärtext |
| `text-2` | `#4A5264` | `#AAB2C4` | Sekundärtext |
| `text-3` | `#79819A` | `#788098` | Tertiär, Labels, Platzhalter |

### 2.4 Sidebar (identisch in Light & Dark)

Die Navigations-Sidebar ist **immer dunkel** (`#12141D` → `#0C0E13` als vertikaler Verlauf): Sie ist der „Boden der Halle", auf dem beide Themes stehen — starke Wiedererkennung, und der Flame-Akzent leuchtet dort in beiden Modi identisch. Aktiver Eintrag: Flame-Gradient-Pille; inaktive Einträge `#9AA2B8`.

**Kontrast-Regeln:** Fließtext immer ≥ 4,5:1 (deshalb `flame-strong` für Textlinks auf hellem Grund, nie `flame` pur). Display-Zahlen ≥ 3:1 (Large-Text-Regel). Statusfarben tragen nie allein Bedeutung — immer Icon oder Label daneben.

---

## 3. Typografie

Alle Fonts frei verfügbar (Google Fonts, OFL) und selbst gehostet (kein CDN):

| Rolle | Font | Schnitte | Einsatz |
|---|---|---|---|
| **Display** | **Barlow Condensed** | 600, 700 | Große Zahlen (KPIs, Beträge, Countdown, Timer), Screen-Titel, Hero. Barlow stammt aus dem Motorsport-Umfeld — kondensiert, schnell, aber freundlich gerundet. |
| **UI/Text** | **Inter** | 400, 500, 600, 700 | Alles andere: Labels, Fließtext, Buttons, Tabellen. `font-feature-settings: "tnum"` in allen Zahlenspalten. |
| **Mono** | **IBM Plex Mono** | 400, 500 | IBAN, Belegnummern, Rechnungs-Nr., Timecodes (0:42), Element-Codes (RollArt). |

**Skala** (Web, 1 rem = 16 px):

| Token | Größe/Zeilenhöhe | Font | Einsatz |
|---|---|---|---|
| `display-xl` | 56/60, -1% | Barlow Cond 700 | Hero-Zahl (Countdown Wettkampf) |
| `display-l` | 40/44, -1% | Barlow Cond 700 | KPI-Zahlen, Beträge |
| `display-m` | 28/32 | Barlow Cond 600 | Kartenzahlen, Sektionstitel groß |
| `title` | 20/28, 600 | Inter | Karten-/Seitentitel |
| `body` | 15/22, 400 | Inter | Standard |
| `body-s` | 13/18, 400–500 | Inter | Tabellen, Sekundäres |
| `label` | 11/14, 600, +6% Sperrung, VERSALIEN | Inter | Spaltenköpfe, Gruppenlabels, Chips |
| `mono-s` | 13/18 | IBM Plex Mono 500 | Codes, Zeiten |

**Plattform-Anmerkung:** Auf iOS/watchOS bleibt Fließtext **SF Pro (System)** mit Dynamic Type; nur Display-Zahlen und Titel verwenden das eingebettete Barlow Condensed. Android analog: Fließtext Roboto/Inter, Display Barlow Condensed. So bleibt das native Gefühl erhalten und das Sport-Branding sitzt trotzdem. (Im HTML-Mockup nähert ein System-Stack — Avenir Next Condensed/Arial Narrow — die Display-Schrift an, da keine externen Ressourcen erlaubt sind.)

---

## 4. Spacing, Radius, Tiefe, Motion

### 4.1 Spacing — 4-px-Raster

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

- Karten-Innenabstand: 20–24 px, Karten-Gap im Grid: 16–20 px
- Seitenränder Desktop: 32 px, Sektionsabstand: 32–40 px
- Touch-Ziele mobil: min. 44 × 44 pt (48 dp Android)

### 4.2 Radius

| Token | Wert | Einsatz |
|---|---|---|
| `r-s` | 8 px | Inputs, kleine Chips, Tabellenzellen-Highlights |
| `r-m` | 12 px | Buttons, Listenelemente |
| `r-l` | 16 px | **Karten (Standard)** |
| `r-xl` | 24 px | Hero-Flächen, Modals, Player |
| `r-full` | 999 px | Pillen, Status-Badges, Avatare, Response-Balken |

### 4.3 Tiefe (Karten mit Schichtung)

Drei Ebenen, jeweils Schatten **plus** 1-px-Hairline (im Dark Mode ersetzt eine hellere Kante + stärkere Abstufung der Flächen den Schatten):

- `elev-1` (ruhende Karte): `0 1px 2px rgb(16 20 33 / .06), 0 4px 12px rgb(16 20 33 / .06)`
- `elev-2` (Hover/aktiv): `0 2px 4px rgb(16 20 33 / .08), 0 12px 28px rgb(16 20 33 / .12)` + `translateY(-2px)`
- `elev-glow` (Primär-CTA): zusätzlich `0 6px 20px rgb(240 78 35 / .35)`

### 4.4 Motion

| Token | Wert | Einsatz |
|---|---|---|
| `motion-fast` | 150 ms, ease-out | Hover, Chips, Buttons |
| `motion-base` | 250 ms, cubic-bezier(.2,.8,.3,1) | Karten-Lift, Panels, Akkordeons |
| `motion-live` | 2 s, infinite | Live-Puls (Aufnahme, laufender Termin), Waveform-Atmung |

Regeln: nichts bewegt sich ohne Nutzeranlass außer Live-Indikatoren; `prefers-reduced-motion: reduce` deaktiviert alle Transitionen und Pulse; keine Dauer-Animation in Finanz-Ansichten.

---

## 5. Komponenten-Prinzipien

1. **StatCard**: Label (VERSALIEN, `text-3`) → Display-Zahl (Barlow) → Delta-Zeile (Pfeil + Vergleichswert, semantisch gefärbt) → optionale Sparkline. Immer klickbar zur Detailansicht.
2. **TerminCard**: Zeit links als Display-Block (wie eine Startzeit auf der Anzeigetafel), Titel + Ort + Team-Chip, darunter der **Response-Balken** (gestapelter Balken Zusagen/Absagen/offen mit Legende) und maximal zwei Aktionen („Anwesenheit starten" = Primär).
3. **KürCard**: Cover-Kachel mit Violett-Verlauf + Statusbadge (Neu/In Arbeit/Wettkampffertig), Läufer:in, Fortschrittsbalken, Warnhinweis (z. B. Musiklänge) als Amber-Chip. Ein Klick → Kür-Detail.
4. **Audio-Player** (Signature-Komponente): eingelassenes Player-Bett (`bg-inset`, `r-xl`), Waveform als Balkenreihe (gespielt = Flame, Rest = neutral), **A-B-Loop als violette Zone** mit A/B-Griffen, Playhead-Linie, Transport (−5 s / Play / +5 s), Tempo-Pillen (0,5–2,0×) + Feinregler, Countdown-Pillen (0/3/5/8 s). Alle Timecodes in Mono. Elemente/Timestamps als klickbare Liste, die auf die Waveform mappt.
5. **Pipeline (Mahnwesen)**: Stufen als Karten-Kette (offen → Erinnerung → 1./2./3. Mahnung) mit Anzahl (Display) + Summe, Verlauf neutral → amber → rot. Automatik-Regeln („Erinnerung nach 14 Tagen") stehen sichtbar daneben — das System sagt, was es von allein tut.
6. **Tabellen**: keine Zebrastreifen; Hairline-Trenner, Zeilen-Hover (`bg-raised`), Beträge rechtsbündig tabellarisch, negative Werte mit Minus **und** Farbe, Status als Badge mit Icon. Spaltenköpfe im `label`-Stil.
7. **Badges/Chips**: `r-full`, Soft-Hintergrund + starker Text derselben Familie, immer mit Punkt-Icon oder Symbol. Ein Badge-Satz für das ganze Produkt (Zusage, Absage, offen, krank, bezahlt, überfällig, Mahnstufe 1–3, live, entwurf …).
8. **Buttons**: Primär = Flame-Gradient + Glow, Sekundär = Outline auf `line-strong`, Tertiär = Soft-Fläche. Nur **ein** Primär-Button pro Ansicht.
9. **Empty States & Feedback**: Jeder Leerzustand hat Illustration light (Linien-Icon), einen Satz und einen CTA. Fehler erzeugen Toasts mit Wiederholen-Aktion — niemals stilles Scheitern (Lehre aus v1). Optimistic UI bei Zusagen/Check-ins.
10. **Fokus & A11y**: 2-px-Fokusring in `flame` mit 2 px Offset auf allen interaktiven Elementen; Kontrast AA; alle Icons mit Label oder `aria-label`; Statusfarben nie alleiniger Bedeutungsträger.

---

## 6. Token-Übersetzung auf iOS / Android / Web

**Eine Quelle:** `design/tokens/momentum.json` (Style-Dictionary-Format, W3C Design Tokens). CI generiert daraus pro Plattform:

| Ziel | Artefakt | Mapping |
|---|---|---|
| **Web (Next.js)** | `tokens.css` (Custom Properties) + Tailwind-Preset | `--rsm-flame`, `--rsm-bg-card` …; Dark Mode via `@media (prefers-color-scheme)` + `[data-theme]`-Override (Toggle) |
| **iOS/macOS/watchOS** | Asset Catalog (Farben mit Light/Dark-Variante) + `Theme.swift` (`RSMColor.flame`, `RSMSpacing.m`, `RSMRadius.card`) | Display-Font als `RSMFont.display(_:)` → Barlow Condensed, Text = SF Pro Dynamic Type; Schatten → `shadowStyle`-Modifier |
| **Android** | `Theme.kt` (Compose `ColorScheme` Light/Dark + `Typography` + `Shapes`) | `MomentumTheme { }`; Display = Barlow Condensed via `FontFamily`, Radius → `RoundedCornerShape(16.dp)` |

Regeln:
- **Semantische Namen, nie Rohwerte** in Feature-Code (`color.action.primary`, nicht `#F04E23`).
- Jede Farbe existiert **als Paar** (light/dark) — es gibt keinen Token ohne Dark-Wert (Dark Mode ist Definition of Done, Lehre aus v1: „Dark-Mode erzwingt Light").
- Spacing/Radius sind plattformneutral in dp/pt/px 1:1 übertragbar (4-px-Raster).
- Motion-Tokens: Web `transition`, iOS `Animation.easeOut(duration:)`, Android `tween(150)` — gleiche Kurven, gleiche Dauern.
- i18n: alle UI-Strings DE + EN ab Tag 1 (Format-Tokens für Beträge/Daten: `de-DE`/`en-GB` via `Intl`/`NumberFormatter`/`ICU`), echte Umlaute verpflichtend, weitere Sprachen (FR/RU/TR) als Ressourcen nachziehbar.

---

## 7. Die drei Mockup-Screens (Begründung)

1. **Trainer-Dashboard** — beweist, dass „Momentum" den Alltag trägt: Heute-Fokus (Termine + Response-Balken), 4 Hero-KPIs, Küren-Schnellzugriff mit Musiklängen-Warnung, Aufgaben mit Deadlines. Sport-Broadcast-Gefühl durch Countdown-Karte „11 Tage bis zur Bezirksmeisterschaft".
2. **Kür-Detail mit Audio-Player** — das Alleinstellungsmerkmal als Bühne: Waveform mit A-B-Loop (violett), Tempo 0,85×, Countdown 3 s, klickbare Element-Timestamps, RollArt-Score-Historie, Musiklängen-Check gegen Kategorie-Limit.
3. **Admin-Finanzübersicht** — beweist, dass das sportliche System Seriosität kann: KPI-Zeile, Mahnstufen-Pipeline mit Automatik-Regeln, offene Posten mit Mahn-Badges, Kassenbuch-Auszug, SEPA-Hinweis. Dieselben Tokens, kein Stilbruch.
