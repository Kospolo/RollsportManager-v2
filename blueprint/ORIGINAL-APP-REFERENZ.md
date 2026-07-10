# RollsportManager — Referenz der Original-App (v1)

**Zweck:** Die eine verbindliche Vorlage für den v2-Neubau. Jede Seite, jede Tabelle,
jede Rolle mit ihren exakten Rechten, jedes Enum, jede kleine, aber wichtige Regel —
belegt aus dem echten v1-Code. Was hier steht, wird in v2 **originalgetreu** nachgebaut.

Legende: 🔎 = direkt im Code verifiziert (mit Fundstelle) · 📝 = aus Backend-Notizen/Dateinamen, Detailtiefe wird beim Bau je Seite verifiziert.

Basis: `/Users/marcelgoldfuss/Apps/RollsportManager` (NUR lesen, niemals ändern).

---

## 1. Rollen- & Rechte-Modell (der Kern — 🔎 code-verifiziert)

### 1.1 Die Rollen (DB-Enum `UserRole`, deutsch)
`mitglied`, `trainer`, `kassenwart`, `moderator`, `admin`, `super_admin` — dazu die
Sonderform `gasttrainer` (befristeter Zugang) und der abgeleitete Zustand **Familie**
(`is_parent_account = true` ODER `parent_id != null`).

### 1.2 Die maßgebliche Rechte-Berechnung
🔎 [portal.js:891-905](RollsportManager/rollsportmanager-backend/www/assets/js/portal.js:891):
```js
const trainerRoles    = ['trainer', 'moderator', 'admin', 'super_admin'];
const adminRoles      = ['moderator', 'admin', 'super_admin'];
const superAdminRoles = ['super_admin'];

const isTrainer    = trainerRoles.includes(profile.role);
const isAdmin      = adminRoles.includes(profile.role);      // Moderator zählt als isAdmin!
const isSuperAdmin = superAdminRoles.includes(profile.role);
const isKassenwart = profile.role === 'kassenwart';
const isFamily     = profile.is_parent_account === true || profile.parent_id != null;

const canManageFinance = isAdmin || isKassenwart;
const canManageMembers = isAdmin || isKassenwart;
```

### 1.3 Rechte-Matrix (daraus abgeleitet)
| Rolle | isTrainer | isAdmin | Mitglieder verw. | Finanzen verw. | Rollen ändern | Plattform (super) |
|---|---|---|---|---|---|---|
| **mitglied** | – | – | – | – | – | – |
| **gasttrainer** | (trainer-ähnlich, **befristet**, teambezogen) | – | – | – | – | – |
| **trainer** | ✓ | – | – | – | – | – |
| **kassenwart** | – | – | ✓ | ✓ | – | – |
| **moderator** | ✓ | ✓ | ✓ | ✓ | ✓ (nur ranktiefere*) | – |
| **admin** | ✓ | ✓ | ✓ | ✓ | ✓ (alle) | – |
| **super_admin** | ✓ | ✓ | ✓ | ✓ | ✓ (alle) | ✓ |

\* **Moderator-Hierarchie** 🔎 [mitglieder.html:683](RollsportManager/rollsportmanager-backend/www/portal/mitglieder.html:683):
```js
canChangeRole = ['admin','super_admin'].includes(userRole)
  || (userRole === 'moderator'
      && member.role !== 'admin' && member.role !== 'moderator' && member.role !== 'super_admin');
```
→ Ein Moderator darf Rollen ändern, **aber nicht** bei Admins/Moderatoren/Super-Admins.
Hinweis: `kassenwart` verwaltet Mitglieder/Finanzen, darf aber **keine Rollen** ändern.

### 1.4 Admin-Konsole: 3-stufige Sichtbarkeit
🔎 [admin.js:439-472](RollsportManager/rollsportmanager-backend/www/assets/js/admin.js:439):
- **Stufe 1 – nur super_admin** (`isFullAdmin()`): Plattform-Seiten (`data-admin-only`, `.nav-admin-only`).
- **Stufe 2 – admin + super_admin** (`isClubAdmin()`): `data-club-admin`, `.nav-club-admin`.
- **Stufe 3 – Moderator eingeschränkt**: Elemente mit `data-min-role="admin"` werden ausgeblendet
  (→ Premium/Lizenzen/Zahlungen bleiben echten Admins vorbehalten).

### 1.5 ⚠️ Sicherheits-Befund (für v2 zwingend anders)
Alle diese Prüfungen sind **rein clientseitig**: Sichtbarkeit via `style.display='none'` und
Redirects (🔎 [auth.js:34 `checkAdminAccess`](RollsportManager/rollsportmanager-backend/www/assets/js/auth.js:34) → `/admin/login.html?error=access_denied`).
Wer die Requests direkt stellt, umgeht sie. **v2 setzt dieselbe Matrix serverseitig durch (RLS + API-Rollencheck gegen die DB), nicht im Client.**

### 1.6 Per-Verein-Modulschalter (🔎 code-verifiziert)
Vereine können Module ein-/ausschalten, z. B. 🔎 [portal.js:918](RollsportManager/rollsportmanager-backend/www/assets/js/portal.js:918)
`PortalState.verein?.modul_checkin_enabled !== false`. → v2 braucht pro Verein aktivierbare Module
(passt zu Blueprint „Kern vs. aktivierbare Module").

---

## 2. Datenmodell (📝 aus Backend-Notizen, beim Bau je Tabelle gegen SQL verifiziert)

**22 Kern-Tabellen:** `users` (mit `parent_id` für Kinder), `vereine`, `teams`, `team_members`,
`team_trainers`, `termine`, `termin_responses`, `attendance`, `messages`, `kueren`,
`kuer_media` (Medien als **Base64**!), `memberships`, `invoices`, `payments`, `facilities`,
`facility_bookings`, `equipment`, `equipment_reservations`, `checkins`, `waitlists`,
`verein_news`, `ubungen`.

**Deutsche Enums (Fallen):**
- `UserRole`: mitglied / trainer / moderator / admin (+ super_admin, gasttrainer, kassenwart)
- `TerminTyp`: training / wettkampf / event
- `KuerStatus`: in_arbeit / bereit / wettkampf / archiviert
- `MediaTyp`: bild / video / audio / dokument

**Spalten-Fallen:** `start_datetime` (nicht start_time), `ort` (nicht location),
`nachricht` (nicht message), `parent_id` (Kind-Verknüpfung), `image_url` (Chat-Bilder).

**v2-Konsequenz:** v2 nutzt bewusst englische Namen (Blueprint E7) — die Feldbedeutungen und
Enum-Werte hier sind die verbindliche fachliche Vorlage für das Mapping.

---

## 3. Seiten-Katalog

### 3.1 Mobile „Mehr"-Raster (aus den Screenshots, iOS) — der Feature-Hub
News · Küren · Teams · Trainingsplan · Training · Chat · Belegungsplan (Hallen & Räume) ·
Ausrüstung · Wettkampf · Finanzen · Auswertung · Berichte & Listen · Termine · Medaillen ·
Familie · Pflichtstunden · Events (überregional) · Check-in (QR) · Notizen · Galerie (PRO) ·
Dokumente (PRO) · Mitglieder · Einstellungen/Verwaltung.
Kopfzeile: 👑 „Verwaltest: <Verein>" mit Vereins-Umschalter · Tab-Bar: Home / Kalender / Teams / Chat / Mehr.

### 3.2 Web-Portal (`www/portal/`) — 🔎 Dateien vorhanden, 📝 Zweck
Kern: index (Dashboard), profile, calendar, termine (4-Status-RSVP), teams, mitglieder,
mitglieder-beitraege, membership, membership-categories, familien-rabatte, family,
guest-trainers + accept-guest-invite, abteilungen, kueren + kuer-detail + kuer-share,
trainingsplan, trainer-attendance, attendance, checkin + checkin-history + my-qrcode,
facilities, bookings, equipment, chat + direktnachrichten, news, notes, documents (PRO),
gallery (PRO), ubungen, achievements (Medaillen), jubilaeen, favoriten, budget, ausgaben,
finance + finance-export, invoices + invoice-admin + invoice-detail, mahnungen, kassenbuch,
jahresabschluss, bankabgleich, payments + payment-methods + payment-detail, pflichtstunden,
monetization, verein + verein-settings + verein-create + verein-join, diverse *-settings
(dashboard/email/notification/backup), admin.html.

### 3.3 Plattform-Super-Admin-Konsole (`www/admin/`) — 🔎 21 Seiten
index, users, vereine, lizenzen, zahlungen, invoice-management, monetization, premium,
statistiken, server + server-settings, system, settings, email, content, seo, legal, beta,
demo-data, chat, login. Zugriff gestuft nach 1.4 (nur super_admin für Plattform-Seiten).

---

## 4. Kleine, wichtige Regeln (die Feinheiten)
- **Familie:** Kinder = User mit `parent_id`; „Account-Upgrade ab 16 Jahren"; bestehende
  User als Kind verknüpfen; `isFamily` schaltet Familien-Ansichten frei (📝 portal-family.js).
- **RSVP ist 4-stufig:** Zusage / Vielleicht / Absage / **Krank** (📝 termine.html) → v2 hat das (yes/no/maybe/sick).
- **PRO-Gating:** Galerie & Dokumente hinter `checkPremiumAccess()` (🔎 gallery.html:437, documents.html:325) → „PRO"-Badges.
- **Gasttrainer:** befristeter, teambezogener Zugang über eigene Einladung (guest-trainers + accept-guest-invite), nicht im normalen Rollen-Array.
- **Chat:** Team-Chat + Direktnachrichten + **Voice-to-Text (Web Speech API)** + Bildnachrichten.
- **Übungs-Bibliothek:** Kategorien aufwärmen/dehnung/kraft/sprung/pirouette/schritt/kombination, Schwierigkeit 1–5, Video/Thumbnail/Anleitung.
- **Wartelisten** (`waitlists`) bei Hallen-/Equipment-Buchung.
- **Kür-Medien als Base64** in `kuer_media` (Performance-Altlast → v2: Object Storage).
- **Werbe-System** für Gratis-Tier (ads.js, ad-banner.js) — entfällt in v2 (Spond-Preismodell).
- **Preis-Limits:** User Basis 0€ (mit Werbung, **max. 50 Mitglieder**), Werbefrei 2€, Unbegrenzt 5€; Vereins-Lizenzen 9/29/59€.
- **5 Sprachen:** DE/EN/FR/RU/TR (🔎 translations.js = 13.026 Zeilen). v2 aktuell nur DE/EN.

---

## 5. Was mein v2-Bau bisher falsch/unvollständig hatte
1. **Rolle `moderator` komplett gestrichen** + die Moderator-Hierarchie (1.3) fehlt.
2. **`kassenwart`** war als „treasurer" da, aber ohne die Regel „Finanzen+Mitglieder ja, Rollen nein".
3. **`super_admin`-Plattformebene** + die ganze `www/admin`-Konsole (21 Seiten) fehlt.
4. **Per-Verein-Modulschalter** (1.6) nicht abgebildet.
5. **~15 Module** gar nicht gebaut (News, Chat, Trainingsplan, Belegungsplan, Ausrüstung,
   Auswertung/Berichte, Medaillen, Pflichtstunden, Events, Check-in, Notizen, Galerie,
   Dokumente, Übungen, Familie-Screen).
6. **Nur 2 statt 5 Sprachen.**
7. Rechte bisher teils client-nah statt konsequent serverseitig für ALLE neuen Module.

---

## 6. Konsequenzen für v2 (Bau-Leitplanken)
- **Rollen-Set korrigieren:** owner(=super_admin-Ebene club-intern) bleibt, aber **`moderator` wieder aufnehmen**;
  `treasurer`=kassenwart mit exakt den Rechten aus 1.3; `super_admin` als Plattform-Claim (app_metadata) getrennt.
- **Eine Rechte-Matrix (1.3) als einzige Wahrheit**, serverseitig in RLS + API durchgesetzt, Client nur zur Anzeige.
- **Zwei-Ebenen-Verwaltung:** Vereins-Verwaltung (Portal) + Plattform-Super-Admin (getrennt).
- **Module als aktivierbare Einheiten** pro Verein (1.6).
- Module aus 5 originalgetreu nachziehen; Reihenfolge wird beim Bau festgelegt.
