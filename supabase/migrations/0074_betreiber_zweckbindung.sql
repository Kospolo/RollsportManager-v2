-- ============================================================================
-- 0074_betreiber_zweckbindung.sql — DER BETREIBER-ÜBERBLICK BEKOMMT EINEN ZWECK.
--
-- ############################################################################
-- ### DER BEFUND ############################################################
-- ############################################################################
-- Gemessen, nicht vermutet (Harness, Seed-Stand):
--
--     Plattform-Admin + eingeschaltete Einsicht
--       -> app.member_coach_notes:  2 Zeilen, VOLLER Notiztext über ein Kind
--          („Erklärung über den Absprung funktioniert bei Lina nicht — …")
--       -> app.locker_rentals:      5 Verträge, inkl. member_id UND Preis
--          („welches Kind mietet welches Fach für wie viel Geld")
--       -> app.sepa_mandates:       3 Mandate (IBAN der Eltern)
--       -> app.invoices:           10 Rechnungen
--
-- Ursache ist EINE Zeile aus 0051:
--     when app.operator_override() then 5   -- owner-gleich, wie r.protected
-- in app.cap_rank. Der Rang 5 galt für JEDE Fähigkeit, und
-- services/api/src/middleware/operator-access.ts schaltet die Einsicht bei
-- JEDEM Request eines Plattform-Tokens ein. Damit war der Betreiber in jedem
-- Verein dauerhaft owner-gleich — ohne Allowlist, ohne Zweck.
--
-- ############################################################################
-- ### DIE ENTSCHEIDUNG (CIO; der Chef kann sie korrigieren) #################
-- ############################################################################
-- Der Plattform-Betreiber ist AUFTRAGSVERARBEITER (Art. 28 DSGVO), nicht
-- Vereinsmitglied. Er braucht Zugriff, um die Plattform zu BETREIBEN und zu
-- UNTERSTÜTZEN. Er braucht NICHT den Klartext interner Trainer-Notizen über
-- Kinder und nicht routinemäßig personenbezogene Miet- und Finanzdetails.
--
-- Art. 29 DSGVO sagt dasselbe in einem Satz: der Auftragsverarbeiter darf
-- personenbezogene Daten „ausschließlich auf Weisung des Verantwortlichen"
-- verarbeiten. Ein Generalschlüssel über ALLE Fähigkeiten ist das Gegenteil
-- einer Weisung — er ist die Abwesenheit jeder Zweckbindung
-- (Art. 5 Abs. 1 lit. b) und jeder Datenminimierung (Art. 5 Abs. 1 lit. c).
--
-- ############################################################################
-- ### WARUM ALLOWLIST UND NICHT DENYLIST ####################################
-- ############################################################################
-- Beide Wege standen zur Wahl. Entschieden wurde die ALLOWLIST, und der Grund
-- ist NICHT Geschmack, sondern was mit der NÄCHSTEN Fähigkeit passiert:
--
--   * DENYLIST („alles außer Trainer-Notizen und Schließfach-Mieten"):
--     Migration 0075 führt eine Fähigkeit 'gesundheitsdaten' ein. Niemand denkt
--     an diese Datei. Der Betreiber liest sie ab dem ersten Tag im Klartext.
--     Die Denylist ist FAIL-OPEN — sie schützt genau das, woran jemand gedacht
--     hat, und nichts sonst.
--
--   * ALLOWLIST („nur diese neun Fähigkeiten"):
--     Dieselbe Migration 0075. Niemand denkt an diese Datei. Der Betreiber
--     bekommt Rang 0 und sieht nichts. Wer will, dass er etwas sieht, muss es
--     HINSCHREIBEN — mit Grund, in einer eigenen Zeile.
--     Die Allowlist ist FAIL-CLOSED.
--
-- Art. 25 Abs. 2 DSGVO („Datenschutz durch Voreinstellung") verlangt genau
-- diese Richtung: die datenschutzfreundliche Einstellung muss die sein, die
-- ohne Zutun gilt. Deshalb ist die Allowlist hier nicht die vorsichtigere
-- Variante, sondern die einzige, die die Vorschrift buchstäblich erfüllt.
--
-- Nebenwirkung, die den Ausschlag mitgegeben hat: bei der Allowlist braucht es
-- KEINEN Wächter, der neue Fähigkeiten einsammelt und mahnt. Der fail-closed-
-- Zustand IST die Mahnung — der Betreiber merkt sofort, dass er etwas nicht
-- sieht, und die Zeile wird bewusst nachgetragen. Ein Wächter, der bei jeder
-- neuen Fähigkeit eine Migration zum Scheitern bringt, wäre die schlechtere
-- Version derselben Sache.
--
-- ############################################################################
-- ### WAS NICHT ANGEFASST WIRD — UND WARUM ##################################
-- ############################################################################
-- 1. app.operator_override() selbst bleibt WORTGLEICH. Sie beantwortet weiter
--    genau eine Frage: „ist die protokollierte Betreiber-Einsicht für diesen
--    Request eingeschaltet?". Neu ist nur, dass ein JA nicht mehr „owner
--    überall" bedeutet, sondern „owner in den freigegebenen Zwecken".
--    Damit bleibt auch die Konstruktion aus 0051 unversehrt: die Einsicht wird
--    weiterhin bei JEDEM Plattform-Request markiert, und genau deshalb
--    schreibt die Middleware weiterhin für JEDEN Plattform-Request eine
--    Protokollzeile. Hätte man stattdessen die Middleware „nur noch manchmal"
--    markieren lassen, wäre der Zugriff enger UND das Protokoll lückenhafter
--    geworden — die falsche Richtung. Der Ort der Einschränkung ist die
--    Datenbank, nicht das Protokoll.
--
-- 2. app.has_club_role() behält den pauschalen Override. Sie ist der
--    STRUKTUR-Gate (0007:276-296: teams/events/news/exercises) und trägt die
--    Zusage aus 0051, dass der Betreiber Küren moderieren und Struktur
--    reparieren kann. Wer sie fail-closed macht, nimmt dem Betreiber
--    Schreibrechte, die diese Entscheidung ihm ausdrücklich lässt.
--    WAS DARAUS FOLGT, STEHT UNTEN UNTER „EHRLICHE GRENZE" — nicht im Bericht
--    schöngeredet, sondern hier benannt.
--
-- 3. Die vier NAMENTLICHEN Rollen-Helfer bekommen dagegen sehr wohl einen
--    Zweck. Sie sind keine Struktur-Gates, sondern tragen einen Namen, der die
--    passende Fähigkeit bereits nennt:
--        app.can_manage_finance   -> 'finance'
--        app.can_manage_members   -> 'members'
--        app.is_club_admin        -> 'club_settings'
--        app.can_change_member_role -> 'roles'
--    Drei davon ändern HEUTE nichts (ihre Fähigkeit ist freigegeben) — sie
--    schreiben die Regel nur auf. Eine ändert alles: 'finance' ist NICHT
--    freigegeben, und can_manage_finance trägt 41 Aufrufstellen. Damit schließt
--    sich die gesamte Finanz-Fläche (member_fees, sepa_mandates,
--    bank_transactions, donations, budgets, ledger_categories, dunning_log) in
--    EINER Funktion statt in sieben Policies.
--
-- ############################################################################
-- ### EHRLICHE GRENZE (nicht wegdiskutiert) #################################
-- ############################################################################
-- Was ein eingeschalteter Betreiber NACH dieser Migration weiterhin erreicht,
-- weil es an app.is_club_trainer / app.is_club_member hängt und nicht an einer
-- Fähigkeit:
--     app.checkins        — wer wann in der Halle war
--     app.chat_messages   — der TEAM-Kanal (Direktnachrichten waren nie offen:
--                           chat_messages_select prüft dort is_own_member)
--     app.waitlists, app.duty_entries, app.event_rsvps, app.documents
-- Das ist KEIN Versehen, sondern die Kehrseite von Punkt 2 oben:
-- app.is_club_trainer(club_id) = has_club_role([owner,admin,moderator,coach,
-- guest_coach]) gated 30 Policies, davon 22 SCHREIBEND (news, exercises,
-- training_slots, achievements, media, regional_events, gallery,
-- department_members, duty_requirements). Sie fail-closed zu machen nimmt dem
-- Betreiber in derselben Zeile die Schreibrechte, die 0051 ihm ausdrücklich
-- gibt — das ist eine eigene Entscheidung und keine Nebenwirkung dieser.
-- Sie steht als benannter offener Punkt im Bericht, mit Messwerten.
--
-- Ebenfalls benannt: app.is_club_member() (0025:85) beginnt seit jeher mit
-- 'app.is_platform_admin() or …' — OHNE die Sitzungsvariable. Dieser Zweig ist
-- älter als 0051 und von dieser Migration unberührt. In der laufenden API ist
-- er trotzdem lückenlos protokolliert, weil die Middleware auf '*' liegt und
-- vor jeder Route eine Zeile schreibt.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. DIE ALLOWLIST.
--
-- Eine Tabelle und keine Konstante im Funktionsrumpf, aus zwei Gründen:
--   * Der GRUND je Fähigkeit bekommt einen Platz, an dem er nicht als Kommentar
--     verrottet. Art. 30 Abs. 2 DSGVO verlangt vom Auftragsverarbeiter ein
--     Verzeichnis der Verarbeitungskategorien — das hier IST dieses Verzeichnis,
--     maschinenlesbar und an derselben Stelle, an der es auch wirkt.
--   * Der VEREIN kann sie lesen (unten, RLS). Zusammen mit
--     app.operator_audit_log (0051) hat der Verantwortliche damit BEIDE Hälften
--     seiner Kontrolle nach Art. 28 Abs. 3 lit. h: was der Betreiber DARF und
--     was er GETAN hat. Eine Konstante im Funktionsrumpf hätte die erste Hälfte
--     im Quelltext versteckt.
--
-- KEINE Vereins-Spalte, mit Absicht: das hier ist die Grenze des
-- Auftragsverarbeiters, nicht eine Einstellung des Vereins. Ein Verein, der dem
-- Betreiber mehr erlauben WILL, tut das nicht hier, sondern durch eine Weisung —
-- und die endet wieder in einer Migration, die diese Datei fortschreibt.
-- ----------------------------------------------------------------------------
create table app.operator_capabilities (
  capability_key text primary key references app.capabilities (key) on delete cascade,
  reason_de      text not null,
  reason_en      text not null,
  constraint operator_capabilities_reason_len
    check (char_length(btrim(reason_de)) between 10 and 400
       and char_length(btrim(reason_en)) between 10 and 400)
);

comment on table app.operator_capabilities is
  'ZWECKBINDUNG des Betreiber-Zugriffs (0074). Abschliessende Liste der Faehigkeiten, in denen die protokollierte Betreiber-Einsicht (app.operator_override, 0051) owner-gleiche Autoritaet gibt. NICHT gelistet = Rang 0, auch fuer den Plattform-Admin. Fail-closed: eine neue Faehigkeit ist fuer den Betreiber automatisch gesperrt, bis jemand sie hier mit Grund eintraegt (Art. 25 Abs. 2 DSGVO). Lesbar fuer jede angemeldete Person — der Verein muss sehen koennen, was sein Auftragsverarbeiter DARF, so wie er in app.operator_audit_log sieht, was er GETAN hat. / Purpose limitation for operator access.';
comment on column app.operator_capabilities.reason_de is
  'Warum der Betrieb der Plattform diese Faehigkeit braucht. Pflichtfeld: eine Freigabe ohne Begruendung ist genau die Sorte Eintrag, die spaeter niemand mehr zurueckzunehmen wagt.';

-- ----------------------------------------------------------------------------
-- 2. Die Allowlist ist zur LAUFZEIT unveränderlich.
--
-- Ohne diesen Trigger wäre die ganze Migration eine Bitte: der Betreiber-Code
-- läuft an einer Stelle im Service-Modus (middleware/operator-access.ts schreibt
-- dort das Protokoll), und service_role umgeht RLS. Ein Fehler oder eine
-- untergeschobene Route könnte sich dort eine Zeile eintragen und wäre eine
-- Sekunde später owner-gleich in einer Fähigkeit, die niemand freigegeben hat.
--
-- Muster wörtlich von app.operator_audit_log_immutable (0051): der Trigger
-- feuert für JEDE Rolle, auch für service_role und psql. Die einzige Ausnahme
-- ist eine Sitzungsvariable, die ausschließlich MIGRATIONEN setzen — sie ist
-- greppbar, und eine Änderung der Allowlist ist damit immer ein Commit und nie
-- ein Klick.
-- ----------------------------------------------------------------------------
create or replace function app.operator_capabilities_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('app.operator_allowlist_change', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception
    'app.operator_capabilities ist zur Laufzeit UNVERAENDERLICH (0074): % ist nicht erlaubt. Die Zweckbindung des Auftragsverarbeiters aendert man in einer Migration, nicht im laufenden Betrieb.',
    tg_op
    using errcode = '42501';
end;
$$;

comment on function app.operator_capabilities_locked() is
  'Sperrt jede Laufzeit-Aenderung der Betreiber-Allowlist (0074) — auch gegen service_role und psql. Ausnahme nur ueber die Sitzungsvariable app.operator_allowlist_change, die ausschliesslich Migrationen setzen.';

create trigger operator_capabilities_locked_insert
  before insert on app.operator_capabilities
  for each row execute function app.operator_capabilities_locked();
create trigger operator_capabilities_locked_update
  before update on app.operator_capabilities
  for each row execute function app.operator_capabilities_locked();
create trigger operator_capabilities_locked_delete
  before delete on app.operator_capabilities
  for each row execute function app.operator_capabilities_locked();

-- ----------------------------------------------------------------------------
-- 3. RLS: LESEN ja, SCHREIBEN nein.
--
-- Lesen für jede angemeldete Person, nicht nur für Vereins-Admins: die Tabelle
-- enthält KEINE personenbezogenen Daten, sondern die Selbstbeschränkung des
-- Auftragsverarbeiters. Sie zu verstecken hätte keinen Schutzzweck und würde
-- nur die Transparenz kosten, die ihr eigentlicher Wert ist.
-- Kein insert/update/delete für authenticated -> RLS verweigert; der Trigger
-- oben deckt zusätzlich service_role ab. Zwei unabhängige Gründe.
-- ----------------------------------------------------------------------------
alter table app.operator_capabilities enable row level security;

create policy operator_capabilities_select on app.operator_capabilities
  for select to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 4. app.operator_may(capability) — der eine Schalter, jetzt MIT Zweck.
--
-- Das coalesce ist dieselbe wichtigste Zeile wie in 0051: die Funktion muss
-- strikt true/false liefern, nie NULL. app.cap_rank wertet sie in einem
-- CASE-WHEN aus (NULL fiele in den else-Zweig, das wäre hier harmlos), aber
-- 14 Schutztrigger negieren die Helfer, die auf demselben Muster stehen — und
-- 'if not NULL then' ist in plpgsql NIE wahr. Der Fehler kostet nichts zu
-- vermeiden und wäre still.
--
-- SECURITY DEFINER, weil die Tabelle RLS trägt: die Funktion muss die Allowlist
-- auch dann lesen können, wenn eine spätere Migration die select-Policy enger
-- zieht. Die Funktion gibt dabei nichts preis — sie beantwortet ausschließlich
-- eine Ja/Nein-Frage über die AUFRUFENDE Person.
--
-- Reihenfolge der Operanden ist Absicht (wie 0051): operator_override() zuerst.
-- Für JEDEN normalen Aufrufer ist danach Schluss — kein Tabellenzugriff, keine
-- Kosten, keine Verhaltensänderung.
-- ----------------------------------------------------------------------------
create or replace function app.operator_may(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app.operator_override()
      and exists (
        select 1 from app.operator_capabilities oc
        where oc.capability_key = p_capability
      ),
    false)
$$;

comment on function app.operator_may(text) is
  'Darf die protokollierte Betreiber-Einsicht (0051) in DIESER Faehigkeit wirken? Verlangt BEIDES: eingeschaltete Einsicht (signierter Plattform-Admin-Claim UND die von der Audit-Middleware gesetzte Sitzungsvariable) UND eine Zeile in app.operator_capabilities. Nicht gelistet = false, auch fuer den Plattform-Admin (fail-closed, Art. 25 Abs. 2 DSGVO). Liefert strikt true/false, nie NULL.';

-- ----------------------------------------------------------------------------
-- 5. app.cap_rank — die eine Zeile aus 0051, jetzt zweckgebunden.
--    Rumpf sonst WORTGLEICH aus 0051:106-133. Ohne Betreiber-Einsicht ist das
--    Ergebnis Bit für Bit dasselbe wie vorher; die 1809 Bestands-Tests belegen
--    es, weil KEINER von ihnen ausser 99e die Sitzungsvariable setzt.
-- ----------------------------------------------------------------------------
create or replace function app.cap_rank(p_club_id uuid, p_capability text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- 0074: nicht mehr 'operator_override()' (jede Fähigkeit), sondern
    -- 'operator_may(p_capability)' (nur die freigegebenen Zwecke).
    when app.operator_may(p_capability) then 5   -- owner-gleich, wie r.protected
    else coalesce((
      select max(
               case when r.protected then 5 else app.level_rank(rp.level) end
             )
      from app.member_roles mr
      join app.roles r        on r.id = mr.role_id
      join app.club_members m on m.id = mr.member_id
      left join app.role_permissions rp
             on rp.role_id = mr.role_id
            and rp.capability_key = p_capability
      where mr.club_id = p_club_id
        and m.profile_id = auth.uid()
        and m.deleted_at is null
        and m.status = 'active'
        and (m.valid_until is null or m.valid_until >= now())
    ), 0)
  end
$$;

comment on function app.cap_rank(uuid, text) is
  'Aufgeloester Rang der aufrufenden Person fuer eine Faehigkeit (0..5): Max ueber ALLE Rollen; owner-Rolle (protected) = immer 5; nichts gesetzt = 0. Seit 0051: bei eingeschalteter Betreiber-Einsicht owner-gleich — seit 0074 aber NUR in den Faehigkeiten, die app.operator_capabilities freigibt (Zweckbindung, Art. 5 Abs. 1 lit. b DSGVO). Der Plattform-Admin-Claim ALLEIN bewirkt weiterhin nichts.';

-- ----------------------------------------------------------------------------
-- 6. app.club_role_held — die REINE Mitgliedschaftsfrage, ohne Betreiber-Zweig.
--
-- Sie existiert, damit die zweckgebundenen Helfer unten nicht in ein CASE
-- laufen müssen. Der Unterschied ist nicht kosmetisch: schriebe man
--     case when operator_override() then operator_may('finance')
--          else has_club_role(...) end
-- dann verlöre eine Person, die BEIDES ist (Plattform-Admin und Vereins-
-- Kassenwart), ihre echte Vereinsrolle, sobald die Einsicht anspringt. Diese
-- Person gibt es im Seed nicht, aber die Bauform darf sie nicht bestrafen.
-- Mit club_role_held bleibt es eine ODER-Verknüpfung: echte Rolle ODER
-- freigegebener Betreiber-Zweck.
--
-- Rumpf wörtlich aus 0025:66-77 / 0051:139-152, nur ohne die Override-Zeile.
-- ----------------------------------------------------------------------------
create or replace function app.club_role_held(p_club_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(app.member_role_keys(p_club_id)) as k
    where k = any (p_roles)
  )
$$;

comment on function app.club_role_held(uuid, text[]) is
  'Haelt die aufrufende Person eine der genannten Rollen im Verein — TATSAECHLICH, ohne jeden Betreiber-Zweig? Die reine Mitgliedschaftsfrage aus 0025. app.has_club_role ist diese Funktion PLUS dem pauschalen Betreiber-Override; die zweckgebundenen Helfer (0074) nehmen dagegen diese hier und haengen ihren eigenen, engeren Betreiber-Zweig daran.';

-- has_club_role: Ergebnis unverändert (Struktur-Gate, siehe Kopf Punkt 2),
-- nur noch einmal über club_role_held ausgedrückt statt dupliziert.
create or replace function app.has_club_role(p_club_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.operator_override() or app.club_role_held(p_club_id, p_roles)
$$;

comment on function app.has_club_role(uuid, text[]) is
  'Haelt die aufrufende Person eine der genannten Rollen im Verein? Aufloesung aus app.member_roles (nicht aus dem JWT) -> Aenderungen wirken sofort. Mehrfachrollen = Vereinigung. Seit 0051: eingeschaltete Betreiber-Einsicht zaehlt als jede Rolle — das ist der STRUKTUR-Gate (teams/events/news/exercises) und bleibt in 0074 bewusst so. Wer eine ZWECKGEBUNDENE Pruefung braucht, nimmt app.club_role_held + app.operator_may (Muster: app.can_manage_finance).';

-- ----------------------------------------------------------------------------
-- 7. Die vier namentlichen Helfer bekommen ihren Zweck.
--    Muster überall gleich: echte Vereinsrolle ODER freigegebener Zweck.
--    Rollenmengen WORTGLEICH aus 0007 — kein Vereinsmitglied verliert oder
--    gewinnt ein Recht.
-- ----------------------------------------------------------------------------

-- FINANZEN. Der Zweck 'finance' ist NICHT freigegeben -> hier wirkt die
-- Migration am stärksten: member_fees, sepa_mandates (IBAN der Eltern),
-- bank_transactions, donations, budgets, ledger_categories, dunning_log.
-- Das ist die Hälfte des Befundes „personenbezogene Miet-/Finanzdetails";
-- die andere Hälfte (invoices, ledger_entries, locker_rentals) hängt ohnehin
-- an has_cap und schließt sich schon über cap_rank.
create or replace function app.can_manage_finance(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['owner', 'admin', 'moderator', 'treasurer'])
      or app.operator_may('finance')
$$;

comment on function app.can_manage_finance(uuid) is
  'Darf die aufrufende Person die Vereinsfinanzen verwalten? Vereinsrollen owner/admin/moderator/treasurer — unveraendert seit 0007. Seit 0074 zweckgebunden fuer den Betreiber: die Betreiber-Einsicht wirkt hier NUR, wenn die Faehigkeit "finance" in app.operator_capabilities freigegeben ist (heute: NICHT). Der Auftragsverarbeiter braucht zum Betrieb der Plattform keine IBAN und keinen Beitragsstand eines Kindes.';

-- MITGLIEDER. Zweck 'members' IST freigegeben -> heute keine Wirkungsaenderung.
-- Die Zeile steht trotzdem hier: sie macht aus einer Nebenwirkung eine Regel.
create or replace function app.can_manage_members(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['owner', 'admin', 'moderator', 'treasurer'])
      or app.operator_may('members')
$$;

comment on function app.can_manage_members(uuid) is
  'Darf die aufrufende Person den Mitgliederbestand verwalten? Vereinsrollen owner/admin/moderator/treasurer — unveraendert seit 0007. Seit 0074 zweckgebunden fuer den Betreiber (Faehigkeit "members", heute freigegeben: ohne Stammdaten ist kein Support-Fall bearbeitbar).';

-- VEREINSLEITUNG. Zweck 'club_settings' IST freigegeben -> keine Aenderung.
create or replace function app.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.club_role_held(p_club_id, array['owner', 'admin', 'moderator'])
      or app.operator_may('club_settings')
$$;

comment on function app.is_club_admin(uuid) is
  'Vereinsleitung (owner/admin/moderator) — unveraendert seit 0007. Seit 0074 zweckgebunden fuer den Betreiber (Faehigkeit "club_settings", heute freigegeben: Vereinseinstellungen und Module sind Betrieb).';

-- ROLLENVERGABE. Zweck 'roles' IST freigegeben -> keine Aenderung.
-- Rumpf wörtlich aus 0051:163-198, nur die erste Bedingung wird zweckgebunden.
create or replace function app.can_change_member_role(p_club_id uuid, p_target_role app.club_member_role)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if app.operator_may('roles') then
    return true;                                   -- owner-gleich (siehe 0051-Kopf)
  end if;

  select min(r.key::app.club_member_role)::text into v_role
  from app.member_roles mr
  join app.roles r        on r.id = mr.role_id
  join app.club_members m on m.id = mr.member_id
  where mr.club_id = p_club_id
    and r.is_system
    and m.profile_id = auth.uid()
    and m.deleted_at is null
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until >= now());

  if v_role is null then
    return false;
  end if;
  if p_target_role = 'owner' then
    return v_role = 'owner';                       -- only owners grant owner
  end if;
  if v_role in ('owner', 'admin') then
    return true;
  end if;
  if v_role = 'moderator' then
    return p_target_role not in ('admin', 'moderator');  -- owner already handled
  end if;
  return false;                                    -- treasurer & below: no roles
end;
$$;

comment on function app.can_change_member_role(uuid, app.club_member_role) is
  'Darf die aufrufende Person die Zielrolle vergeben? Vereinslogik unveraendert seit 0025. Seit 0074 zweckgebunden fuer den Betreiber (Faehigkeit "roles", heute freigegeben: die Rechte-Matrix zu reparieren ist der haeufigste Support-Fall).';

-- ----------------------------------------------------------------------------
-- 8. DIE FREIGABEN. Neun Zeilen, jede mit Grund.
--
-- Der Maßstab war für jede Zeile derselbe: „Kann der Betreiber die Plattform
-- ohne diese Fähigkeit betreiben oder einen gemeldeten Fehler bearbeiten?"
-- Nur wenn die Antwort NEIN ist, steht sie hier.
--
-- BEWUSST NICHT FREIGEGEBEN — die 24 übrigen, darunter namentlich:
--   coach_notes     Die interne Notiz über ein Kind. Der Kern des Befundes.
--                   0069 hat sie sogar der eigenen MUTTER verschlossen, wenn
--                   diese Moderatorin ist. Ein Auftragsverarbeiter, der sie
--                   nebenbei mitliest, macht diese Entscheidung zunichte.
--   lockers         „Welches Kind mietet welches Fach für wie viel Geld."
--   finance         Rechnungen, Mandate, Beitragsstände einzelner Familien.
--   member_contact  Adresse, Telefon, Geburtsdatum. Für den Support nicht nötig:
--                   die E-Mail steht in /platform/users (auth.users, die eigene
--                   Datenhaltung des Betreibers).
--   attendance,
--   checkins        Wann welches Kind wo war. Ein Bewegungsprofil ist nichts,
--                   was man „zum Betrieb" braucht.
--   chat            Vereinsinterne Kommunikation.
--   documents,
--   media, gallery  Inhalte des Vereins, oft mit Kinderfotos.
--   events, competitions, tasks, training_slots, exercises, achievements,
--   news, equipment, equipment_reservations, facilities, facilities_booking,
--   duty_hours, waitlists, regional_events
--                   Fachbetrieb des Vereins. Kein Betriebs- oder Supportzweck.
-- ----------------------------------------------------------------------------
select set_config('app.operator_allowlist_change', 'on', true);

insert into app.operator_capabilities (capability_key, reason_de, reason_en) values
  ('members',
   'Stammdaten und Status. Ohne sie ist kein gemeldeter Fehler bearbeitbar ("Mitglied X kann sich nicht anmelden", "steht im falschen Team"). Umfasst NICHT die Kontaktdaten — die stehen unter member_contact und sind gesperrt.',
   'Member master data and status. Without it no reported issue can be worked on ("member X cannot sign in", "is in the wrong team"). Does NOT include contact details - those live under member_contact and are denied.'),

  ('roles',
   'Die Rechte-Matrix. Der haeufigste Support-Fall ueberhaupt ("unser Kassenwart sieht die Rechnungen nicht mehr") laesst sich ohne sie weder nachstellen noch beheben.',
   'The permission matrix. The single most common support case ("our treasurer can no longer see the invoices") can neither be reproduced nor fixed without it.'),

  ('club_settings',
   'Vereinseinstellungen und Modulschalter. Das ist Betrieb im engsten Sinn: ein falsch gesetzter Modulschalter laesst halbe Bereiche der App verschwinden.',
   'Club settings and module switches. Operations in the narrowest sense: a wrongly set module switch makes entire areas of the app disappear.'),

  ('departments',
   'Sparten- und Abteilungsstruktur (0062). Strukturfehler hier wirken sich auf Teams, Rechte und Auswertungen aus und sind vom Verein selbst oft nicht aufloesbar.',
   'Department and section structure (0062). Structural errors here cascade into teams, permissions and reports and often cannot be resolved by the club itself.'),

  ('teams',
   'Teamstruktur. Dieselbe Begruendung wie departments; ausserdem haengt die teamgebundene Sichtbarkeit vieler Module daran.',
   'Team structure. Same reasoning as departments; team-bound visibility of many modules depends on it.'),

  ('team_coaches',
   'Trainer-Zuordnung (0031). Sie entscheidet, wer welche Kinder sieht — eine falsche Zuordnung ist ein Datenschutzvorfall und muss vom Betreiber korrigierbar sein.',
   'Coach assignment (0031). It decides who sees which children - a wrong assignment is a privacy incident and must be correctable by the operator.'),

  ('routines',
   'Kueren ansehen. Von 0051 ausdruecklich als Bedarf benannt (Moderation der eingereichten Kueren) und in 99e gemessen.',
   'Viewing routines. Explicitly named as a requirement by 0051 (moderating submitted routines) and measured in 99e.'),

  ('routines_edit',
   'Der Schreibpfad zu routines. Eine Moderation, die nur lesen darf, ist keine.',
   'The write path for routines. Moderation that can only read is not moderation.'),

  ('anniversaries',
   'Jubilaeen. Von 0051 ausdruecklich benannt und in 99e gemessen. Rein abgeleitet aus members, das ohnehin freigegeben ist — eine Sperre haette hier nichts geschuetzt, nur eine Auswertung zerbrochen.',
   'Anniversaries. Explicitly named by 0051 and measured in 99e. Purely derived from members, which is allowed anyway - denying it would have protected nothing and only broken a report.');

select set_config('app.operator_allowlist_change', 'off', true);

-- ----------------------------------------------------------------------------
-- 9. NACHRECHNUNG statt Behauptung.
--    Muster: 0070 Abschnitt 10 / 0033. Was hier zusichert wird, wird hier
--    nachgemessen — sonst ist es ein Kommentar und keine Eigenschaft.
-- ----------------------------------------------------------------------------
do $$
declare
  v_missing text;
  v_count   int;
begin
  -- (a) Die namentlich ausgeschlossenen Faehigkeiten sind wirklich draussen.
  --     Wer sie spaeter eintraegt, bringt die naechste Migration zu Fall —
  --     und das ist der Punkt.
  select string_agg(k, ', ') into v_missing
  from unnest(array['coach_notes', 'lockers', 'finance', 'member_contact',
                    'attendance', 'checkins', 'chat']) as k
  where exists (select 1 from app.operator_capabilities where capability_key = k);
  if v_missing is not null then
    raise exception '0074: diese Faehigkeiten duerfen NICHT auf der Betreiber-Allowlist stehen: %', v_missing;
  end if;

  -- (b) Die Allowlist ist echt kleiner als der Katalog. Waere sie es nicht,
  --     haette diese Migration nichts bewirkt und niemand haette es gemerkt.
  select count(*) into v_count from app.operator_capabilities;
  if v_count >= (select count(*) from app.capabilities) then
    raise exception '0074: die Allowlist umfasst den ganzen Katalog (%) — das ist kein Zweck, das ist der alte Generalschluessel', v_count;
  end if;

  -- (c) app.cap_rank ruft wirklich operator_may und nicht mehr operator_override.
  --     Eine spaetere Neufassung von cap_rank, die die alte Zeile zurueckholt,
  --     faellt damit hier auf statt erst im naechsten Datenschutz-Audit.
  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'cap_rank'
      and p.prosrc like '%operator_may(p_capability)%'
  ) then
    raise exception '0074: app.cap_rank fragt nicht app.operator_may(p_capability) — die Zweckbindung waere wirkungslos';
  end if;
end;
$$;

commit;
