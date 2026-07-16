# RollsportManager v2 — Konfigurierbares Rechte-System (RBAC)

Verbindliche Bau-Spezifikation. Ersetzt das feste „eine Rolle pro Person"-Modell durch ein
konfigurierbares, **serverseitig durchgesetztes** RBAC. Vom Nutzer genehmigt (2026-07-11).

> ## ⚠️ KORREKTUREN NACH PHASE 1 (2026-07-16) — gelten VOR dem Rest des Dokuments
> Phase 1 ist gebaut (Commit 41db579, Migrationen 0022–0026, 667 Tests grün). Beim Bau hat sich
> gezeigt, dass diese Spec an mehreren Stellen **von der Realität des Codes abweicht**. Wo Spec und
> Code sich widersprechen, **gilt der Code**. Konkret ist unten überholt:
> - **§4 `team_coaches`** ist KEINE Tabelle, sondern eine **View auf `team_members(role='coach')`**.
>   Die Spec-Prämisse „bestehende Coach-Zuordnung (teams.coach*)" (§8) ist **falsch** — `app.teams`
>   (0003:30-38) hat keine solche Spalte. Mehrfachteams konnte `team_members` schon immer.
>   Keine zweite Tabelle bauen: das wäre eine driftende zweite Wahrheit.
> - **§3 Standard-Stufen** sind NICHT geseedet. Geseedet ist der **Ist-Zustand des Codes**; an 5 Stellen
>   weicht er ab (routines/treasurer=read_own · lockers/moderator+coach=read_own · attendance/member=read_all ·
>   member_contact/coach=none · finance/coach=read_own). Grund: die Spec-Defaults hätten Rechte
>   **verschoben statt migriert**. Per Admin-UI (§7) sind sie ohnehin frei setzbar.
> - **§5 `has_cap`** hat **keinen impliziten `is_platform_admin`-Bypass** (wäre eine Aufweichung).
> - **Auflösung:** nicht jede Policy wurde umgeschrieben — umgestellt wurde der Rumpf von
>   `app.has_club_role` (JWT-Claim → DB). Alle ~110 Policies ziehen automatisch nach und sind
>   sofortwirksam ohne Re-Login.
>
> ### Vom Nutzer entschieden (2026-07-16)
> 1. **Mitgliedschafts-Gate freigegeben:** `deleted_at`/`status`/`valid_until` gelten seit 0025 für
>    **jede** Rolle (vorher nur `guest_coach`). Austritt/Soft-Delete entzieht Rechte **sofort**.
> 2. **Küren-Asymmetrie wird aufgelöst:** statt der einen Fähigkeit `routines` kommen **zwei** —
>    `routines_read` (none/read_own/read_team/read_all) und `routines_edit` (none/edit/manage).
>    Damit wird „Trainer:in schreibt alle, liest nur eigene Teams" auf zwei geordneten Skalen
>    darstellbar und im Admin konfigurierbar. Der bisher fest verdrahtete Schreibpfad
>    (`is_club_trainer`) wird in Phase 2 auf `routines_edit` umgestellt — **Seed = heutiges Verhalten**.
> 3. **Phase 2 ist freigegeben** (API + Contracts).
>
> ### Offen aus Phase 1 (in Phase 2/0027+ mitziehen)
> - **`none` sperrt bisher nur SCHREIBEN, nicht LESEN** (z. B. `attendance_select` ist weiterhin
>   `is_club_member`). Das UI darf `none` deshalb **nicht als „abgeschaltet" verkaufen**, solange die
>   SELECT-Policies nicht umgestellt sind — sonst täuscht die Oberfläche den Nutzer.
> - **`guards.ts:104` ist laxer als die DB** (treasurer dürfte dort `targetRole='member'` setzen;
>   `app.can_change_member_role` sagt nein — heute nur vom Trigger abgefangen).
>   In Phase 2 die **API an die DB** angleichen, NICHT die DB lockern.
> - **API liest die Primärrolle noch aus dem Claim** (210 Guard-Aufrufe in 40 Dateien) → Mehrfachrollen
>   wirken erst voll, wenn die Guards auf `has_cap`/`/me/capabilities` stehen. Heute fail-closed.
> - **Performance ungemessen** — `cap_rank` ist ein 3er-Join pro Policy (STABLE, pro Statement gecacht),
>   Indizes liegen. Vor Prod-Rollout `EXPLAIN ANALYZE` mit realistischem Volumen.
> - **Betrieb:** `supabase/tests/run-tests.sh` und `services/api/scripts/api-db-test.sh` brauchen
>   `HARNESS_HOST_PORT=55434`, solange der fremde Container `rapportmanager-postgres-1` Port 55432 hält.

## 1. Anforderungen (vom Nutzer)
1. **Stufen statt on/off** pro Bereich: keine / (lesen mit Umfang) / bearbeiten / verwalten.
2. **Eigene Rollen anlegen** — 7 Systemrollen als Vorlage, dazu beliebige Verein-Rollen.
3. **Mehrere Rollen pro Person** — Rechte = Vereinigung (höchste Stufe gewinnt).
4. **Trainer:in für mehrere Teams** — n:m-Zuordnung; „sieht seine Teams" liest daraus.

## 2. Stufen-Modell (eine geordnete Skala pro Fähigkeit)
Rang: `none=0 · read_own=1 · read_team=2 · read_all=3 · edit=4 · manage=5`.
Pro Fähigkeit ist nur eine sinnvolle Teilmenge wählbar (UI zeigt nur diese).
- Lesen mit Umfang: `read_own` (nur eigene), `read_team` (eigenes/​betreutes Team), `read_all` (alle).
- `edit` = ändern (impliziert read_all), `manage` = anlegen/löschen/verwalten (impliziert edit).
RLS-Zeilenfilter richtet sich nach dem aufgelösten Rang: ≥read_all → alle Zeilen; =read_team → Team-Zeilen; =read_own → eigene Zeilen; ≥edit → schreiben erlaubt.

## 3. Fähigkeiten-Katalog (Startsatz, erweiterbar)
| key | Optionen | Standard member | Standard coach | Standard treasurer | admin/owner |
|---|---|---|---|---|---|
| members | none/read_names/read_all/manage | read_names | read_all | read_all | manage |
| member_contact (Geb./E-Mail) | none/read | none | read | read | read |
| routines (Küren) | none/read_own/read_team/read_all/manage | read_own | read_team | none | manage |
| lockers | none/read_own/read_all/manage | read_own | none | read_all | manage |
| facilities_booking | none/read/book/manage | read | book | none | manage |
| equipment_reservations | none/read_own/read_all/manage | read_own | read_all | none | manage |
| attendance | none/read_own/read_team/read_all/manage | read_own | read_team | none | manage |
| anniversaries (Jubiläen) | none/read_team/read_all | read_team | read_all | read_all | read_all |
| finance (Kassenbuch/Rechnungen/Mahnwesen/…) | none/read_own/manage | read_own | none | manage | manage |
| news/documents/gallery/chat/achievements/waitlists/departments/duty_hours/budget/… | je passende Teilmenge | sinnvoller Default aus der Sicherheits-Runde | | | |
| platform_admin | none/manage | – | – | – | nur is_platform_admin |
(Diese Defaults = Startkonfiguration jedes Vereins; danach frei änderbar.)

## 4. Datenmodell (neue Tabellen)
- `app.capabilities(key PK, label, allowed_levels text[])` — Katalog (statisch geseedet).
- `app.roles(id, club_id, key, name, is_system bool, protected bool, sort)` — 7 System- + eigene Rollen je Verein. owner = protected (immer manage überall).
- `app.role_permissions(id, club_id, role_id, capability_key, level)` — Rolle × Fähigkeit → Stufe.
- `app.member_roles(id, club_id, member_id, role_id)` UNIQUE(member_id, role_id) — **mehrere Rollen pro Person**.
- `app.team_coaches(id, club_id, team_id, member_id)` UNIQUE(team_id, member_id) — **Trainer:in ↔ mehrere Teams**.
- `club_members.role` bleibt als denormalisierte „Primärrolle" (Anzeige/Sortierung), Autorisierung läuft aber NUR über member_roles/has_cap.

## 5. Durchsetzung (SECURITY DEFINER Helfer)
- `own_member_id(club_id) → uuid` (aus auth.uid()).
- `coached_team_ids(club_id) → uuid[]` (aus team_coaches).
- `cap_rank(club_id, capability) → int` — Max-Rang über ALLE Rollen der Person (member_roles → role_permissions). Kein Token-Claim mehr → Änderungen wirken sofort, ohne Re-Login.
- `has_cap(club_id, capability, min_rank) → bool`.
- **Alle RLS-Policies** (≈25 Tabellen) werden von `has_club_role(...)` auf `has_cap(club_id, '<cap>', <rang>)` + Umfangsfilter (own/team/all via cap_rank) umgestellt.
- API-Spaltenprojektion (Roster sensible Felder) richtet sich nach `member_contact`.

## 6. API
- `GET /me/capabilities?club_id` → aufgelöste Stufen der eingeloggten Person (für UI-Gating).
- Rollen-Admin: `GET/POST/PATCH/DELETE /clubs/{id}/roles`, `PUT /clubs/{id}/roles/{roleId}/permissions` (Matrix), `PUT /clubs/{id}/members/{memberId}/roles` (Mehrfachzuweisung), `PUT /clubs/{id}/teams/{teamId}/coaches` (Trainer-Teams). Alles gated `manage` auf `roles`/`teams` bzw. owner/admin.
- Contracts (TS/Swift/Kotlin) neu generieren.

## 7. Admin-UI (Verwaltung → „Rollen & Rechte")
Aus der bisherigen statischen Matrix wird die **editierbare Steuerzentrale**:
- Rollen-Liste: Systemrollen + „Rolle anlegen" (Name), bearbeiten, löschen (System geschützt).
- Rechte-Matrix: pro Fähigkeit × Rolle ein **Stufen-Dropdown** (nur erlaubte Optionen), speichern.
- Personen: einer Person **mehrere Rollen** zuweisen (Chips).
- Teams: einer:m Trainer:in **mehrere Teams** zuordnen.
- Client liest `/me/capabilities` und gated die gesamte Oberfläche danach.

## 8. Migration/Rollout (kein Bruch)
- Seed capabilities + 7 Systemrollen je Verein mit den Default-Stufen aus Abschnitt 3.
- Bestehende `club_members.role` → passender `member_roles`-Eintrag.
- Bestehende Coach-Zuordnung (teams.coach*) → `team_coaches`.
- Reihenfolge: ERST die laufende Sicherheits-Verschärfung (feste Defaults) fertig, DANN dieser Umbau darüber — die festen Defaults werden die editierbare Startkonfiguration.

## 9. Bau-Phasen (mehrere Durchläufe, budgetbewusst)
1. **Kern-Backend**: Tabellen + Helfer + Datenmigration + Seed + RLS-Umstellung der Kern-Tabellen (members/lockers/routines/facilities/equipment/attendance/finance) + pgTAP-Tests (jede Rolle/Stufe).
2. **API + Contracts**: /me/capabilities + Rollen-/Zuweisungs-Endpoints + Regen + Tests.
3. **Web-Admin-UI**: editierbare Matrix + Rollen anlegen + Mehrfachrollen + Trainer-Teams + client-seitiges Capability-Gating.
4. **Integration + Verifikation** (je Rolle/Konfiguration im Preview) + Commit. Danach iOS/Android ziehen automatisch nach (gleiche API/RLS); native UI-Gating in einem späteren Pass.
