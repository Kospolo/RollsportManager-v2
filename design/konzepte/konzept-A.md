# Konzept A — „Klar & Professionell"

**RollsportManager v2 · Designkonzept 1 von 3 · Stand 09.07.2026**
Mockup: `konzept-A.html` (selbstenthaltend, Light + Dark, drei Desktop-Screens)

---

## 1. Designphilosophie

**Zielgefühl: „Endlich Ordnung im Verein."**

RollsportManager v1 ist ein Feature-Baukasten mit 40+ Sidebar-Links, 26 „Mehr"-Kacheln und 11 Finanzseiten (UX-Report 12). Konzept A antwortet darauf mit dem Gegenteil von Dekoration: einem **Ledger-Prinzip** — die Anmutung eines perfekt geführten Kassenbuchs, übertragen auf ein modernes SaaS-Produkt der Linear-/Vercel-Schule und moderner Finanz-Tools.

Fünf Grundsätze:

1. **Hierarchie durch Typografie, nicht durch Dekoration.** Größe, Gewicht und Laufweite ordnen die Seite. Keine Verläufe, keine Illustrations-Teppiche, keine Schatten-Orgien.
2. **Zahlen sind Bürger erster Klasse.** Jeder Wert — Beträge, Uhrzeiten, Tempi, Rechnungsnummern, Timecodes — steht in einer Monospace-Schrift mit Tabellenziffern, rechtsbündig wo er verglichen wird. Das ist die bewusste gestalterische Zuspitzung dieses Konzepts: Die App *fühlt* sich dadurch an wie ein Präzisionsinstrument.
3. **Hairlines statt Schatten.** Flächen werden durch 1-px-Linien und minimale Tonwert-Stufen getrennt. Elevation existiert nur für Overlays (Menüs, Dialoge, Command-Palette).
4. **Ein Akzent, Semantik nur für Bedeutung.** Das „Vereinsblau" markiert ausschließlich Interaktion und Fokus. Grün/Bernstein/Rot sind reserviert für Zahlungs- und Anwesenheitsstatus — nie dekorativ.
5. **Ruhe ist ein Feature.** Viel Weißraum, klare Raster, max. 6 Navigationsziele pro Rollen-Workspace (Trainer / Verwaltung / Mitglied), ⌘K-Suche als universeller Ausgleich für flache Navigation (UX-Report, Empfehlungen 2 + 3).

**Warum das zur Marke passt:** Vereins-Admins und Kassenwarte arbeiten heute mit Excel, Vereinsheft und Bank-Portal. Ein ruhiges, präzises Interface signalisiert: Hier liegt Geld richtig, hier stimmen die Zahlen, hier geht nichts verloren. Für Trainer bedeutet dieselbe Ruhe: Am Hallenrand zählt jede Sekunde — das UI konkurriert nie mit dem Training.

---

## 2. Farbsystem

### 2.1 Akzent: „Vereinsblau"

Kein Linear-Indigo, kein Standard-Tailwind-Blau: Das Kobalt ist aus der deutschen Vereinskultur begründet — Blau-Weiß ist die häufigste Vereinsfarbkombination im deutschen Rollsport. Es wirkt amtlich-verlässlich (Urkunde, Vereinswappen) und bleibt im Dark Mode als aufgehelltes Kobalt lebendig.

### 2.2 Palette Light

| Token | Hex | Verwendung |
|---|---|---|
| `bg/canvas` | `#F6F7F9` | App-Hintergrund (kühl, nicht creme) |
| `bg/surface` | `#FFFFFF` | Karten, Tabellen, Panels |
| `bg/surface-2` | `#F1F3F6` | Inset-Flächen, Zebra, Hover |
| `bg/surface-3` | `#E9ECF1` | Gedrückt, Segmente inaktiv |
| `border/default` | `#E4E7ED` | Hairlines, Kartenränder |
| `border/strong` | `#D2D8E0` | Inputs, Fokus-Nachbarschaft |
| `text/primary` | `#161A22` | Überschriften, Werte |
| `text/secondary` | `#4C5566` | Fließtext, Zellen |
| `text/tertiary` | `#8891A2` | Labels, Meta, Platzhalter |
| `accent/default` | `#2D5BE3` | Vereinsblau — Aktionen, Links, aktive Zustände |
| `accent/strong` | `#2149C4` | Hover/Pressed |
| `accent/soft` | `#E9EEFC` | Aktiv-Hintergründe, Loop-Region |
| `positive` | `#1B7A4B` auf `#E3F3EA` | Bezahlt, Zusage, Limit eingehalten |
| `warning` | `#96610D` auf `#FAF0DC` | Erinnerung, fällig, offene Rückmeldung |
| `negative` | `#C13A3A` auf `#FBEAEA` | Mahnung, Absage, überfällig |

### 2.3 Palette Dark

Kein reines Schwarz; Tiefe entsteht über Flächenstufen, nicht über Schatten. Semantikfarben werden aufgehellt und leicht entsättigt, damit sie auf dunklem Grund nicht „glühen".

| Token | Hex | Verwendung |
|---|---|---|
| `bg/canvas` | `#0F1218` | App-Hintergrund |
| `bg/surface` | `#161A22` | Karten |
| `bg/surface-2` | `#1C212C` | Inset, Hover |
| `bg/surface-3` | `#232936` | Gedrückt, Segmente |
| `border/default` | `#262D3A` | Hairlines |
| `border/strong` | `#364052` | Inputs |
| `text/primary` | `#EAEDF3` | Überschriften, Werte |
| `text/secondary` | `#A9B1C2` | Fließtext |
| `text/tertiary` | `#707A8E` | Labels, Meta |
| `accent/default` | `#6787FA` | Vereinsblau Dark |
| `accent/strong` | `#8FA8FF` | Hover |
| `accent/soft` | `#1D2740` | Aktiv-Hintergründe |
| `positive` | `#53C08A` auf `#152B20` | — |
| `warning` | `#DCA349` auf `#2B2113` | — |
| `negative` | `#E56A61` auf `#301716` | — |

### 2.4 Regeln

- Akzentfarbe nie als Flächen-Dekoration, nur für: Primär-Buttons, Links, aktive Navigation, Selektion, Waveform-Fortschritt, Loop-Region, Fokus-Ring.
- Mahnstufen haben eine feste Farbtreppe: *Offen* = neutral, *Erinnerung* = warning, *1./2./3. Mahnung + Inkasso* = negative (Eskalation über Badge-Text, nicht über immer grellere Farben).
- Alle Text/Hintergrund-Paare erfüllen WCAG AA (≥ 4,5:1 Fließtext, ≥ 3:1 große Ziffern); die Palette ist in beiden Modi gegengeprüft.

---

## 3. Typografie

**Zwei Stimmen — Sprache und Werte:**

| Rolle | Font | Quelle | Begründung |
|---|---|---|---|
| UI & Display | **Hanken Grotesk** (Variable, 300–800) | Google Fonts, OFL | Warm-neutrale Grotesk mit hoher x-Höhe: exzellent lesbar bei 13–14 px in dichten Tabellen; deutlich eigenständiger als das allgegenwärtige Inter; sehr gute Umlaut-/ß-Zeichnung |
| Werte & Daten | **IBM Plex Mono** (400/500/600) | Google Fonts, OFL | Beträge, Uhrzeiten, Timecodes, Tempi, IBAN, Rechnungs- und Element-Codes; Tabellenziffern serienmäßig, technisch-präziser Charakter |
| Fallback | System-Stapel | — | `-apple-system, "Segoe UI", system-ui` bzw. `ui-monospace, "SF Mono", Menlo` — das Mockup läuft komplett auf dem Fallback |

**Skala (Web-Referenz, 4-px-Raster):**

| Token | Größe/Zeile | Gewicht | Einsatz |
|---|---|---|---|
| `display` | 28/34 | 700 | Begrüßung, Seiten-Held |
| `title-1` | 22/28 | 650 | Seitentitel (Topbar) |
| `title-2` | 16/22 | 600 | Kartentitel, Kür-Titel |
| `body` | 14/21 | 400–500 | Fließtext, Tabellenzellen |
| `body-sm` | 13/19 | 400–500 | Sidebar, dichte Tabellen |
| `label` | 11/14 | 600, +0.06 em, Versalien | Spalten-Header, Eyebrows, Abschnitts-Label |
| `value-lg` | 24/30 | Mono 500 | KPI-Zahlen |
| `value` | 13–14 | Mono 500, `tnum` | Beträge, Zeiten inline |

Regeln: max. zwei Gewichte pro Fläche; Versal-Labels sind das einzige „laute" Strukturelement; Zahlen in Vergleichskontexten immer rechtsbündig + Mono; deutsche Typografie korrekt (echter Gedankenstrich, „deutsche Anführungszeichen", `−` als Minuszeichen, schmales Leerzeichen vor €).

---

## 4. Spacing, Radius, Elevation

**Spacing — 4-px-Basisraster:**

| Token | px | Einsatz |
|---|---|---|
| `space-1…3` | 4/8/12 | Chip-Innenräume, Icon-Abstände |
| `space-4` | 16 | Standard-Innenabstand Listenzeilen |
| `space-5` | 20–24 | Karten-Padding |
| `space-6` | 32 | Abstand zwischen Karten/Sektionen |
| `space-7/8` | 48/64 | Seitenränder, Held-Abstände |

**Radius:**

| Token | px | Einsatz |
|---|---|---|
| `radius-sm` | 6 | Buttons, Inputs, Chips, Segmente |
| `radius-md` | 10 | Karten, Tabellen-Container |
| `radius-lg` | 14 | Modals, Command-Palette, Fenster |
| `radius-full` | 999 | Avatare, Status-Punkte, Pills |

**Elevation:** Ebene 0 = Canvas, Ebene 1 = Karte (Hairline, kein Schatten), Ebene 2 = Overlay (`0 8px 24px rgba(22,26,34,.10)` Light / `0 12px 32px rgba(0,0,0,.4)` Dark). Mehr Ebenen gibt es nicht.

---

## 5. Komponenten-Prinzipien

- **Navigation = Rollen-Workspaces.** Trainer sehen *Heute, Kalender, Teams, Küren, Wettkampf, Nachrichten*; Verwaltung sieht *Übersicht, Mitglieder, Beiträge & Finanzen, Berichte, Kommunikation*. Maximal 6 Ziele + Einstellungen; Modul-Schalter konfigurieren Inhalte, nie Menülänge (Antwort auf UX-Befund „40+ Links").
- **⌘K überall.** Die Command-Palette (Suche über Mitglieder, Termine, Rechnungen, Küren + Aktionen) sitzt permanent in der Sidebar und ersetzt Navigationstiefe.
- **Tabellen sind das Herzstück.** Versal-Spaltenköpfe (11 px), 1-px-Zeilentrenner, 44-px-Zeilenhöhe, Beträge rechtsbündig in Mono, Hover-Fläche, Aktionen erst bei Hover sichtbar. Filter als Chip-Leiste über der Tabelle, Summenzeile im Footer. Jede Liste hat einen Empty-State **mit** Call-to-Action (UX-Befund 15).
- **Status als Chip-System.** Eine Chip-Komponente, vier semantische Varianten (neutral/positiv/warnung/negativ) trägt Zusagen, Zahlungs- und Mahnstufen, Kür-Status — überall identisch. Punkte-Indikator + Text, nie Farbe allein (Accessibility).
- **Buttons:** Primär (Vereinsblau, weiße Schrift) maximal 1× pro Ansicht; Sekundär = Hairline-Ghost; destruktive Aktionen rot erst im Bestätigungs-Schritt.
- **Der Kür-Player ist das Signature-Element.** Ein „Arbeitsinstrument" mit Balken-Waveform: gespielter Bereich in Vereinsblau, A-B-Loop als akzentgefüllte Region mit A/B-Griffen, Marker (Sprünge, Pirouetten, Schrittfolgen) als klickbare Timecodes, Tempo als Segment-Steuerung (0,7×–1,15× Presets + Feinregler 0,5–2,0), Countdown 0/3/5/8 s. Alle Zeiten in Mono. Der Player behält seine Gestalt auf allen Plattformen — er ist das Wiedererkennungszeichen des Produkts.
- **Zustände sind Systemteil:** Skeleton beim Laden, Empty-State mit CTA, Fehler als Toast mit Klartext + Wiederholen-Aktion (nie stilles Scheitern — UX-Befund „print-Fehler").
- **Motion:** 120–200 ms, nur Ease-out-Übergänge für Hover/Overlay/Selektion; ein orchestrierter Moment (Command-Palette). `prefers-reduced-motion` deaktiviert alles Nicht-Essentielle.

---

## 6. Accessibility & i18n

- Kontrast AA in beiden Modi (geprüft), Fokus-Ring 2 px Vereinsblau mit 2 px Offset auf allen interaktiven Elementen, Touch-Ziele ≥ 44 px auf Touch-Plattformen.
- Status nie nur über Farbe (immer Punkt/Icon + Text), Waveform mit textueller Zeit-Ausgabe für Screenreader.
- Dynamic Type / Font-Scaling: Skala in relativen Einheiten, Layouts brechen kontrolliert um.
- **DE + EN als Pflicht ab dem ersten String** (v1-Erbe: FR/RU/TR als Ressourcen-Ausbau). Deutsche Strings mit echten Umlauten (ä/ö/ü/ß). Layout-Reserve +30 % Textlänge (EN→DE-Schwellung), keine Text-in-Bild-Elemente.

---

## 7. Token-Architektur: eine Quelle, vier Plattformen

Die Tokens leben als **eine JSON-Quelle** (Style-Dictionary-Format) im Monorepo und werden in CI generiert — Parität per Konstruktion statt Checkliste (Antwort auf v1-Systemkrankheit „4× implementieren").

```json
{
  "color": {
    "accent": {
      "default": { "value": "#2D5BE3", "darkValue": "#6787FA" },
      "soft":    { "value": "#E9EEFC", "darkValue": "#1D2740" }
    },
    "bg": {
      "canvas":  { "value": "#F6F7F9", "darkValue": "#0F1218" },
      "surface": { "value": "#FFFFFF", "darkValue": "#161A22" }
    }
  },
  "radius": { "sm": { "value": 6 }, "md": { "value": 10 }, "lg": { "value": 14 } },
  "space":  { "4": { "value": 16 }, "6": { "value": 32 } }
}
```

**Generierte Ziele:**

| Plattform | Output | Mapping |
|---|---|---|
| Web (Next.js) | CSS Custom Properties + Tailwind-Theme | `--color-accent`, Dark via `@media (prefers-color-scheme)` + `[data-theme]`-Override |
| iOS/macOS/watchOS (SwiftUI) | `Theme.swift` — `Color`/`Font`-Extensions + Asset-Catalog-Farben (Light/Dark-Paare) | `Color.rsm.accent`, `Font.rsm.value(24)`; Radius/Spacing als `CGFloat`-Konstanten; Dynamic-Type-Mapping der Skala auf `UIFontMetrics` |
| Android (Compose) | `Theme.kt` — `ColorScheme`-Mapping + eigene `RsmTokens` | Akzent → `primary`, `surface-2` → `surfaceContainer`; Mono-Werte als eigene `Typography`-Slots (`valueLarge`, `value`) |
| Widgets/Watch | reduziertes Subset (Canvas, Text, Akzent, Semantik) | identische Hex-Werte, keine eigene Palette |

**Plattform-Idiome bleiben nativ:** Navigation (Tab-Bar iOS, Navigation-Bar Android, Sidebar Web/iPad/macOS), Schalter, Datums-Picker und Haptik folgen der Plattform — Farben, Typo-Skala, Radius, Spacing, Chip-/Badge-Semantik und der Kür-Player sind überall identisch. Fonts: Hanken Grotesk + IBM Plex Mono werden auf iOS/Android gebundelt, im Web self-hosted (`font-display: swap`).

---

## 8. Abgrenzung & Risiko

- **Bewusstes Risiko:** die durchgängige Mono-Werte-Typografie (auch groß in KPIs). Sie ist ungewöhnlich für Vereins-Software — genau dadurch entsteht die Finanz-Tool-Glaubwürdigkeit, die v1 fehlt. Rückfallebene: Mono nur in Tabellen/Player, KPI in Grotesk-SemiBold.
- **Kein Linear-Klon:** eigenes Kobalt statt Indigo, Hanken statt Inter, Ledger-Metapher statt Dev-Tool-Ästhetik, Semantikfarben-Treppe fürs Mahnwesen als domänenspezifisches System.
- **Was dieses Konzept nicht ist:** verspielt, jugendlich, bunt. Falls die Jury Emotion für die Mitglieder-/Eltern-Persona vermisst: Der Mitglieder-Workspace kann auf derselben Token-Basis wärmer moduliert werden (mehr `accent/soft`, Foto-Flächen), ohne das System zu brechen.

---

## 9. Das Mockup

`konzept-A.html` zeigt drei Desktop-Portal-Screens (≈1240 px) mit echtem Beispielinhalt des fiktiven Vereins **RSV Blau-Weiß Neckarsulm e. V.**:

1. **Trainer-Dashboard „Heute"** — Termine mit Rückmeldungs-Chips, Anwesenheits-Trend, Küren-Schnellzugriff mit Mini-Waveforms, offene Aufgaben, Wettkampf-Countdown.
2. **Kür-Detail „Carmen — Kurzkür 2026"** — der Signature-Player: Waveform, A-B-Loop (0:38–1:04), Tempo 0,85×, Countdown 5 s, Marker-Liste, Längen-Check gegen Kategorie-Limit, Bewertungen, Notizen.
3. **Admin-Finanzübersicht** — KPI-Zeile, Beitrags-Pipeline (bezahlt → offen → erinnert → gemahnt), Offene-Posten-Tabelle mit Mahnstufen-Badges und Filter-Chips, Kassenbuch-Auszug mit fortlaufendem Saldo, Mahn-Automatik-Karte.

Interaktiv im Mockup: Theme-Umschalter (plus `prefers-color-scheme`-Default), klickbare Waveform, Tempo-/Countdown-Segmente, Loop-Toggle, Tabellen-Filter, abhakbare Aufgaben.
