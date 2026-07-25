-- ============================================================================
-- 0081_vereins_stammdaten_smtp.sql — der VEREIN bekommt sein volles Profil.
--
-- Bis hierher kannte app.clubs nur Name, Kuerzel, Ort, Disziplin, Gruendungsjahr
-- (0002) und ein Freiform-settings-JSONB (fuer Modulschalter u. ae.). Der alte
-- v1-Verein konnte deutlich mehr: eine ordentliche Anschrift, einen Kontakt, eine
-- Webseite, eine Selbstbeschreibung — und einen EIGENEN SMTP-Absender fuer
-- Anmeldungs-/Info-Mails (v1: 20260127_verein_email_settings.sql). Diese
-- Migration holt das nach und legt zusaetzlich den Grundstein fuer ein
-- oeffentliches Vereinsprofil.
--
-- Alle Angaben sind Spalten an app.clubs (EIN Verein = EINE Zeile) — kein
-- Nebentisch wie invoice_settings (0080), denn anders als der Rechnungs-Briefkopf
-- sind Stammdaten der Verein selbst, kein abschaltbares Finanz-Modul.
--
-- ############################################################################
-- ### WER SCHREIBT, WER LIEST — KEINE NEUE RLS NOETIG #######################
-- ############################################################################
-- app.clubs traegt seit 0002/0007 bereits genau die zwei Policies, die der
-- Auftrag verlangt, und die neuen Spalten erben sie unveraendert:
--   * clubs_select  USING (deleted_at IS NULL AND app.is_club_member(id))
--                   -> Lesen = jedes Vereinsmitglied.
--   * clubs_update  USING/CHECK app.is_club_admin(id)
--                   -> Schreiben = is_club_admin (owner/admin/moderator).
-- RLS ist ZEILEN-, nicht spaltenweise; eine gesonderte "nur is_club_admin"-
-- Policy fuer die SMTP-Spalten gibt es daher bewusst NICHT. Der SMTP-Block wird
-- stattdessen an DREI Stellen geschuetzt (Tiefenstaffelung):
--   1. Schreiben laeuft ausschliesslich ueber clubs_update = is_club_admin.
--   2. Der Lese-/Schreib-Endpunkt (GET/PATCH /clubs/{id}/smtp) ist zusaetzlich
--      per requireClubRoleDb(ADMIN_ROLES) auf is_club_admin gesperrt.
--   3. Das Passwort ist WRITE-ONLY: die API gibt NIE den Klartext zurueck, nur
--      smtp_password_set:boolean — exakt wie internal.platform_settings.smtp
--      (routes/platform-settings.ts). Die allgemeine Vereinsansicht
--      (GET /clubs, CLUB_COLUMNS) fuehrt KEINE smtp-Spalte mit, ein normales
--      Mitglied bekommt die SMTP-Daten also ueber keinen Endpunkt zu sehen.
--
-- ############################################################################
-- ### SPALTENRECHTE — DER STOLPERSTEIN AUS 0035 ############################
-- ############################################################################
-- Weil 0035 das SELECT-Recht auf clubs.join_code der Rolle `authenticated`
-- ENTZOGEN hat, traegt app.clubs seither SPALTENWEISE Grants (nicht mehr das
-- Tabellen-Grant). Folge: eine NEU hinzugefuegte Spalte hat fuer authenticated
-- ZUNAECHST GAR KEIN Recht — SELECT/UPDATE darauf quittieren mit 42501, obwohl
-- RLS passt. Jede neue Spalte muss deshalb unten explizit gegrantet werden,
-- sonst laeuft weder die Vereinsansicht noch das Speichern.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- [1] STAMMDATEN. Kontakt, Anschrift, Webseite, Selbstbeschreibung.
--     Alle Textfelder non-null mit Default '' — "nicht gesetzt" ist der
--     Leerstring, kein NULL-Jonglieren (dieselbe Linie wie 0080). Gruendungsjahr
--     (founded_year) existiert seit 0002 und wird nur editierbar gemacht (API),
--     keine Schema-Aenderung noetig.
-- ----------------------------------------------------------------------------
alter table app.clubs
  add column contact_email text not null default '',
  add column contact_phone text not null default '',
  add column street        text not null default '',
  add column postal_code   text not null default '',
  add column country       text not null default '',
  add column website_url    text not null default '',
  add column description    text not null default '';

comment on column app.clubs.contact_email is
  'Oeffentliche Kontakt-E-Mail des Vereins (Vorstand/Geschaeftsstelle). / Public club contact email.';
comment on column app.clubs.street is
  'Strasse + Hausnummer. Ort liegt weiterhin in clubs.city (0002). / Street; the town stays in clubs.city.';
comment on column app.clubs.description is
  'Freitext "Ueber den Verein" (intern). Das OEFFENTLICH sichtbare Pendant ist public_description. / Internal "about the club" free text.';

-- ----------------------------------------------------------------------------
-- [2] VEREINS-SMTP. Eigener Absender fuer Anmeldungs-/Info-Mails (v1-Modell,
--     20260127_verein_email_settings.sql). Port-Default 587 (STARTTLS-Submission),
--     secure-Default true. Das Passwort ist WRITE-ONLY (siehe Kopf, Punkt 3).
-- ----------------------------------------------------------------------------
alter table app.clubs
  add column smtp_host     text    not null default '',
  add column smtp_port     integer not null default 587,
  add column smtp_user     text    not null default '',
  add column smtp_from     text    not null default '',
  add column smtp_secure   boolean not null default true,
  add column smtp_password text    not null default '',
  add constraint clubs_smtp_port_check check (smtp_port between 1 and 65535);

comment on column app.clubs.smtp_password is
  'WRITE-ONLY. Wird NIE im API-Response im Klartext geliefert — die API maskiert '
  'auf smtp_password_set:boolean (exakt wie platform_settings.smtp). Der Zugriff '
  'auf den SMTP-Block laeuft ausschliesslich ueber den admin-gesperrten Endpunkt '
  'GET/PATCH /clubs/{id}/smtp. / Write-only SMTP password, never returned in clear.';
comment on column app.clubs.smtp_from is
  'Absenderadresse/-name fuer Vereinsmails, z. B. "RSV Neckarsulm <noreply@rsv.de>". / From header for club mail.';

-- ----------------------------------------------------------------------------
-- [3] OEFFENTLICHES PROFIL + AKTIVIEREN-SCHALTER.
--     public_profile_enabled ist der ausdrueckliche Opt-in: solange false, darf
--     der Verein NICHT auf der oeffentlichen Website erscheinen (Default false =
--     nichts ohne Zustimmung nach aussen). public_description/public_image sind
--     die bewusst fuer die Oeffentlichkeit freigegebenen Felder (getrennt von der
--     internen description, damit intern != oeffentlich bleiben kann).
--
--     ### ABSICHTLICH NICHT TEIL DIESER MIGRATION ###
--     Die eigentliche oeffentliche Seite (alle opt-in-Vereine als Kachel-Slider)
--     ist ein SEPARATER Folgeschritt. Hier entstehen NUR das Datenmodell + der
--     Schalter; es gibt noch KEINE oeffentliche Read-Policy/Route, die diese
--     Spalten login-frei ausliefert. Ein Verein kann sich also schon "bereit"
--     schalten, sichtbar wird er erst, wenn die oeffentliche Seite gebaut ist.
-- ----------------------------------------------------------------------------
alter table app.clubs
  add column public_profile_enabled boolean not null default false,
  add column public_description     text    not null default '',
  add column public_image           text    not null default '';

comment on column app.clubs.public_profile_enabled is
  'Opt-in: true = Verein DARF auf der oeffentlichen Website gezeigt werden. Die '
  'oeffentliche Slider-Seite selbst folgt in einem separaten Schritt (noch keine '
  'login-freie Read-Policy). / Opt-in flag for the (future) public club directory.';

-- ----------------------------------------------------------------------------
-- SPALTENRECHTE (siehe Kopf): app.clubs traegt seit 0035 spaltenweise Grants,
-- neue Spalten muessen einzeln gegrantet werden. SELECT + UPDATE genuegen fuer
-- Ansicht + Speichern; INSERT der Vollstaendigkeit halber (POST /clubs setzt die
-- Felder nicht, sie kommen per Default — aber die Spalten sollen konsistent zu
-- den Bestandsspalten grantbar sein).
-- smtp_password: SELECT wird ebenfalls gegrantet, damit der admin-gesperrte
-- Endpunkt den Ausdruck (smtp_password <> '') als smtp_password_set berechnen
-- kann — der Klartext verlaesst die API trotzdem nie (API-Maskierung, Punkt 3).
-- ----------------------------------------------------------------------------
grant select (
  contact_email, contact_phone, street, postal_code, country, website_url, description,
  smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, smtp_password,
  public_profile_enabled, public_description, public_image
) on app.clubs to authenticated;

grant insert (
  contact_email, contact_phone, street, postal_code, country, website_url, description,
  smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, smtp_password,
  public_profile_enabled, public_description, public_image
) on app.clubs to authenticated;

grant update (
  contact_email, contact_phone, street, postal_code, country, website_url, description,
  smtp_host, smtp_port, smtp_user, smtp_from, smtp_secure, smtp_password,
  public_profile_enabled, public_description, public_image
) on app.clubs to authenticated;

commit;
