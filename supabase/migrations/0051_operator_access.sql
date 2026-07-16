-- ============================================================================
-- 0051_operator_access.sql — DER BETREIBER-ZUGRIFF UND SEIN PROTOKOLL.
--
-- ### Das Problem, das diese Migration behebt ###
-- Die Schichten widersprachen sich. Auf RLS-Ebene sieht der Plattform-Admin
-- laengst alles (app.is_club_member, 0025:85-94, beginnt mit
-- 'app.is_platform_admin() or …'; can_read_routine 0026:130 ebenso). Der
-- API-Gate sperrte ihn aber aus: app.cap_rank hat bewusst KEINEN Bypass
-- (0025:219-222), also lieferte jeder requireCap ein 403 — ausgerechnet auf
-- Mitglieder, Kueren und Jubilaeen. Der Betreiber kam in seine Konsole, aber
-- nicht in einen Verein hinein. Das war kein Sicherheitsgewinn, sondern ein
-- unentschiedener Zustand: RLS laesst durch, der Gate sperrt.
--
-- ### Die Entscheidung: ein AUSDRUECKLICHER, PROTOKOLLIERTER Schalter ###
-- Nicht gewaehlt wurde Variante (a) „cap_rank bekommt den Bypass". Grund ist
-- nicht Bequemlichkeit, sondern ein nachgelesener Fakt: 90_roles_matrix.sql:148
-- friert zwei Zusicherungen ein —
--     'platform admin: has no club-role WRITE (team INSERT rejected)'   -> teams_insert
--       = app.has_club_role(club_id, [owner,admin,moderator,coach])   (0007:276)
--     'platform admin: cannot self-plant a club_members row'            -> club_members_insert
--       = app.has_cap(club_id,'members','manage') -> app.cap_rank      (0026:33)
-- Ein bedingungsloser cap_rank-Bypass haette die ZWEITE Zusicherung gebrochen.
-- Bestands-Tests duerfen nicht geaendert werden -> (a) ist raus.
--
-- Also Variante (c): app.operator_override(). Der Bypass verlangt ZWEI Dinge
-- gleichzeitig:
--     1. app.is_platform_admin()  — der signierte Claim (JWT, ES256/JWKS in
--        prod). Nicht selbst vergebbar: er stammt aus GoTrues app_metadata,
--        das ein Endnutzer nicht schreiben kann.
--     2. die Sitzungsvariable app.operator_override = 'on' — die setzt AUSSER
--        der Audit-Middleware niemand (services/api/src/db.ts). Kein Claim,
--        kein Token, keine Nutzereingabe kann sie setzen: sie ist eine reine
--        Server-Entscheidung innerhalb der Transaktion (SET LOCAL).
--
-- Damit gilt WEITERHIN woertlich, was 90_roles_matrix.sql zusichert: ein
-- Plattform-Admin-JWT ALLEIN gibt keinerlei Schreibrecht im Verein. Die
-- Bestands-Suite laeuft unveraendert gruen — sie setzt die Variable nirgends,
-- also ist der Schalter fuer sie schlicht nicht vorhanden. Neu ist nur: es
-- GIBT jetzt einen bewussten Weg hinein — und der protokolliert sich selbst.
--
-- ### Warum der Schalter genau hier sitzt ###
-- In cap_rank + has_club_role + can_change_member_role — den drei Funktionen,
-- an denen die ~110 Policies und alle API-Gates haengen. Ein eingeschalteter
-- Betreiber hat damit UEBERALL owner-gleiche Autoritaet, in DB und API
-- gleichzeitig. Genau das war die Forderung: EIN einheitlicher Zugriff, nicht
-- zwei Schichten, die sich widersprechen.
--
-- ### Der Preis, der ihn zulaessig macht ###
-- Marcel ist Auftragsverarbeiter der Vereine und sieht Daten von KINDERN.
-- Art. 28 Abs. 3 lit. h und Art. 32 DSGVO verlangen Nachweisbarkeit. Fragt ein
-- Verein „wer hat wann unsere Mitgliederdaten angesehen?", muss er es
-- beantworten koennen. Deshalb: app.operator_audit_log, append-only, mit
-- Loeschfrist — und der Verein darf es SELBST lesen (siehe unten).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- app.operator_override() — der eine Schalter.
--
-- current_setting(..., true) = missing_ok -> NULL statt Fehler, wenn die
-- Variable nie gesetzt wurde (der Normalfall: jeder Request eines normalen
-- Mitglieds).
--
-- ### Das coalesce ist die wichtigste Zeile dieser Datei ###
-- Ohne es liefert die Funktion NULL statt false — naemlich genau dann, wenn
-- is_platform_admin() true ist und die Variable fehlt (true AND NULL = NULL;
-- fuer alle anderen greift false AND NULL = false, deshalb faellt es beim
-- Testen fast nicht auf). Dieses NULL waere KEINE Kleinigkeit, sondern ein
-- Loch: has_club_role gaebe es als 'select operator_override() or exists(…)'
-- weiter (NULL or false = NULL), und 14 SCHUTZTRIGGER negieren diese Helfer —
-- 0007:196/203/229/234, 0002:238/262, 0021:135, 0024:191/210/218, 0010:137/142,
-- 0017:118. In plpgsql ist 'if not NULL then …' NIE wahr: der Trigger haette
-- also stillschweigend AUFGEHOERT zu schuetzen, ausgerechnet fuer den
-- Plattform-Admin und ausgerechnet OHNE eingeschaltete Einsicht.
-- Belegt: eine Sabotage dieser Zeile faellt sofort in 20_privilege_escalation
-- Test 51 auf ('dies in the trigger' -> der Trigger feuerte nicht mehr, es
-- rettete nur noch die RLS-Policy dahinter). Genau die stille Verschiebung von
-- der ersten in die zweite Verteidigungslinie, die dieser Auftrag beheben soll.
-- Die Funktion liefert deshalb strikt true/false, nie NULL.
--
-- Reihenfolge der Operanden ist Absicht: is_platform_admin() zuerst. Fuer
-- JEDEN normalen Aufrufer ist damit nach dem ersten Operanden Schluss —
-- der Schalter kostet sie nichts und kann sie nichts angehen.
-- ----------------------------------------------------------------------------
create or replace function app.operator_override()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    app.is_platform_admin()
      and pg_catalog.current_setting('app.operator_override', true) = 'on',
    false)
$$;

comment on function app.operator_override() is
  'Ausdrueckliche Betreiber-Einsicht: signierter Plattform-Admin-Claim UND die von der Audit-Middleware gesetzte Sitzungsvariable app.operator_override. Beides zusammen — der Claim allein reicht NICHT (90_roles_matrix.sql:148 bleibt woertlich gueltig). Die Variable setzt ausschliesslich services/api/src/db.ts, nachdem middleware/operator-access.ts den Zugriff protokolliert hat. Kein Claim und keine Nutzereingabe kann sie setzen.';

-- ----------------------------------------------------------------------------
-- cap_rank — Body wortgleich aus 0025:225-243 uebernommen, nur der
-- Override-Zweig kommt davor. Ohne Override ist das Ergebnis Bit fuer Bit das
-- alte (die 852 Bestands-Tests belegen es).
-- ----------------------------------------------------------------------------
create or replace function app.cap_rank(p_club_id uuid, p_capability text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.operator_override() then 5   -- owner-gleich, wie r.protected
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
  'Aufgeloester Rang der aufrufenden Person fuer eine Faehigkeit (0..5): Max ueber ALLE Rollen; owner-Rolle (protected) = immer 5; nichts gesetzt = 0. Seit 0051: bei eingeschalteter Betreiber-Einsicht (app.operator_override) = 5 — der Plattform-Admin-Claim ALLEIN bewirkt weiterhin nichts.';

-- ----------------------------------------------------------------------------
-- has_club_role — Body wortgleich aus 0025:66-77, Override davor.
-- Damit zieht auch alles nach, was NICHT auf Faehigkeiten umgestellt ist:
-- teams/events/news/exercises (0007:276-296) und is_club_admin/is_club_trainer.
-- ----------------------------------------------------------------------------
create or replace function app.has_club_role(p_club_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.operator_override()
      or exists (
    select 1
    from unnest(app.member_role_keys(p_club_id)) as k
    where k = any (p_roles)
  )
$$;

comment on function app.has_club_role(uuid, text[]) is
  'Haelt die aufrufende Person eine der genannten Rollen im Verein? Aufloesung aus app.member_roles (nicht aus dem JWT) -> Aenderungen wirken sofort. Mehrfachrollen = Vereinigung. Seit 0051: eingeschaltete Betreiber-Einsicht (app.operator_override) zaehlt als jede Rolle — der Plattform-Admin-Claim ALLEIN weiterhin als keine.';

-- ----------------------------------------------------------------------------
-- can_change_member_role — der Betreiber hat keine Vereinsrolle, also liefert
-- die Rangermittlung fuer ihn null -> false. Mit eingeschalteter Einsicht soll
-- er Rollen vergeben duerfen ("rechte … fuer module und vereine und mitglieder").
-- Der Rest des Bodys ist wortgleich aus 0025:106-141.
-- ----------------------------------------------------------------------------
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
  if app.operator_override() then
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

-- ============================================================================
-- DAS PROTOKOLL. Ohne das ist der Zugriff oben nicht zulaessig.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Warum app.* und NICHT internal.*
--
-- internal ist service_role-only (0001:29-37) — dort koennte niemand das
-- Protokoll faelschen, aber eben auch NIEMAND es lesen. Genau das waere der
-- Fehler: der Zweck des Protokolls ist die Auskunft an den VEREIN. Der Verein
-- ist Verantwortlicher fuer die Daten seiner Kinder, Marcel nur
-- Auftragsverarbeiter. Ein Nachweis, den der Verantwortliche nur ueber eine
-- Mail an den Auftragsverarbeiter bekommt — und den dieser nach Belieben
-- zusammenstellt — ist als Nachweis nach Art. 28 Abs. 3 lit. h wenig wert.
--
-- Deshalb app.* mit RLS:
--   * LESEN: der Plattform-Admin (seine Konsole) UND die Admins des
--     betroffenen Vereins (ihre Auskunft). Ein normales Mitglied sieht nichts —
--     das Protokoll nennt Routen und Mitglieder-IDs und ist selbst sensibel.
--   * SCHREIBEN: gar keine Policy fuer authenticated -> RLS verweigert. Die
--     Zeile schreibt ausschliesslich die Middleware im Service-Modus. Der
--     Betreiber kann sich also keine Zeile erfinden UND keine loeschen.
-- ----------------------------------------------------------------------------
create table app.operator_audit_log (
  id               uuid        primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  -- WER. Bewusst OHNE Fremdschluessel auf app.profiles: das Protokoll muss den
  -- Betreiber-Account ueberleben. Ein Nachweis, der beim Loeschen des Taeters
  -- mitverschwindet, ist keiner.
  actor_profile_id uuid        not null,
  -- WELCHER VEREIN. Ebenfalls ohne Fremdschluessel (ueberlebt die Vereins-
  -- Loeschung). NULL = Zugriff ohne Vereinsbezug (die reine Betreiber-Konsole,
  -- z. B. /platform/stats) — auch der wird protokolliert, siehe Middleware.
  club_id          uuid,
  -- WAS. route = das Muster (/clubs/{clubId}/members), nicht die konkrete URL:
  -- konkrete URLs koennen personenbezogene Daten in Query-Parametern tragen.
  route            text        not null,
  method           text        not null,
  -- LESEND ODER SCHREIBEND. Die Frage, die ein Verein zuerst stellt.
  access           text        not null check (access in ('read', 'write')),
  -- WELCHE MITGLIEDER. Nur wo guenstig ermittelbar (Pfad-/Body-Parameter);
  -- bei Listen-Routen leer — dort sind Route + Verein die Aussage.
  member_ids       uuid[]      not null default '{}'::uuid[],
  -- ERGEBNIS.
  status           integer     not null,
  request_id       text,
  ip               inet,
  detail           jsonb       not null default '{}'::jsonb,
  expires_at       timestamptz not null default (now() + interval '365 days')
);

comment on table app.operator_audit_log is
  'Protokoll JEDES Zugriffs eines Plattform-Admins (Betreiber). Der Grund, warum der Betreiber-Vollzugriff (app.operator_override) ueberhaupt zulaessig ist: Art. 28 Abs. 3 lit. h + Art. 32 DSGVO verlangen Nachweisbarkeit, und es geht um Daten von Kindern. APPEND-ONLY (Trigger, auch gegen service_role). Lesbar fuer den Betreiber UND fuer die Admins des betroffenen Vereins — der Verein ist Verantwortlicher und muss selbst nachsehen koennen, wer in seine Daten geschaut hat.';
comment on column app.operator_audit_log.actor_profile_id is
  'Ohne Fremdschluessel: das Protokoll muss den Betreiber-Account ueberleben.';
comment on column app.operator_audit_log.route is
  'Routen-MUSTER, nicht die konkrete URL — konkrete URLs koennen personenbezogene Daten in Query-Parametern tragen.';
comment on column app.operator_audit_log.member_ids is
  'Betroffene Mitglieder, soweit guenstig ermittelbar (Pfad-/Body-Parameter). Leer bei Listen-Routen: dort sind Route + Verein die Aussage.';
comment on column app.operator_audit_log.expires_at is
  'Loeschfrist, siehe app.purge_operator_audit_log(). 365 Tage — begruendet, nicht geraten (Art. 5 Abs. 1 lit. e vs. Art. 28 Abs. 3 lit. h).';

create index operator_audit_log_club_idx   on app.operator_audit_log (club_id, occurred_at desc);
create index operator_audit_log_actor_idx  on app.operator_audit_log (actor_profile_id, occurred_at desc);
create index operator_audit_log_expires_idx on app.operator_audit_log (expires_at);

alter table app.operator_audit_log enable row level security;

-- Lesen: Betreiber (Konsole) ODER Vereins-Admin des betroffenen Vereins (Auskunft).
--
-- ACHTUNG, subtil: app.is_club_admin() laeuft ueber has_club_role und haette
-- damit seit oben den Override-Zweig. Das ist hier ohne Wirkung und trotzdem
-- richtig — der Betreiber ist ja bereits ueber is_platform_admin() drin, und
-- ein Vereins-Admin loest den Override nie aus (ihm fehlt der signierte Claim).
create policy operator_audit_log_select on app.operator_audit_log
  for select to authenticated
  using (
    app.is_platform_admin()
    or (club_id is not null and app.is_club_admin(club_id))
  );

-- KEINE insert/update/delete-Policy fuer authenticated. RLS ohne Policy =
-- verweigert. Geschrieben wird nur im Service-Modus (Middleware).

-- ----------------------------------------------------------------------------
-- APPEND-ONLY ist eine Zusage, keine Bitte (Muster: ledger_entries_no_update/
-- no_delete 0005:147-165, app.deny_mutation 0034:422-433). Der Trigger feuert
-- fuer JEDE Rolle — auch fuer service_role, also auch gegen unseren eigenen
-- API-Code und gegen psql.
--
-- Die EINZIGE erlaubte Ausnahme ist die Loeschfrist, und die ist doppelt
-- eingeschnuert: sie verlangt die Variable app.audit_purge (setzt nur
-- app.purge_operator_audit_log()) UND old.expires_at <= now(). Selbst wer die
-- Variable setzen koennte, bekaeme damit nur Zeilen heraus, deren Frist
-- ohnehin abgelaufen ist. Anders gesagt: dieses Protokoll kann NIE etwas
-- anderes verlieren als bereits verfallene Zeilen.
-- ----------------------------------------------------------------------------
create or replace function app.operator_audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and pg_catalog.current_setting('app.audit_purge', true) = 'on'
     and old.expires_at <= pg_catalog.now() then
    return old;                                   -- die Loeschfrist, nur sie
  end if;
  raise exception
    'app.operator_audit_log ist APPEND-ONLY (Art. 28 Abs. 3 lit. h DSGVO): % ist nicht erlaubt. Ein Protokoll, das der Protokollierte aendern kann, ist als Nachweis wertlos.',
    tg_op
    using errcode = '42501';
end;
$$;

create trigger operator_audit_log_no_update
  before update on app.operator_audit_log
  for each row execute function app.operator_audit_log_immutable();

create trigger operator_audit_log_no_delete
  before delete on app.operator_audit_log
  for each row execute function app.operator_audit_log_immutable();

-- ----------------------------------------------------------------------------
-- Die Loeschfrist: 365 Tage. Begruendung statt Zahlenraten.
--
-- Die Vorgabe von internal.auth_events (14 Tage, 0034:265) passt hier NICHT.
-- Dort geht es um Brute-Force-Abwehr — ein Angriffsmuster ist nach zwei Wochen
-- erkannt oder gar nicht. Hier geht es um etwas anderes:
--
--   * WOFUER wir es aufheben (Art. 28 Abs. 3 lit. h): der Verein darf die
--     Verarbeitung ueberpruefen. Solche Ueberpruefungen laufen im JAHRESTAKT
--     (Jahreshauptversammlung, jaehrliche Pruefung des Auftragsverarbeiters).
--     Bei 6 Monaten koennte ein Verein seine eigene Jahrespruefung nicht mehr
--     vollstaendig belegen — die erste Jahreshaelfte waere schon geloescht.
--     365 Tage sind die kleinste Frist, die eine LUECKENLOSE Jahrespruefung
--     ueberhaupt zulaesst.
--   * WOGEGEN es abzuwaegen ist (Art. 5 Abs. 1 lit. e, Datensparsamkeit): das
--     Protokoll ist selbst personenbezogen — es nennt den Betreiber und
--     betroffene Mitglieder-IDs. Deshalb NICHT unbegrenzt, obwohl das fuer die
--     Nachweisfuehrung bequemer waere.
--   * Auch eine Beschwerde bei der Aufsichtsbehoerde erreicht den
--     Auftragsverarbeiter selten in Wochen; nach einem Jahr ist der Vorgang
--     dagegen praktisch immer aktenkundig oder erledigt.
--
-- 365 Tage ist damit der begruendete Schnittpunkt: genau ein Pruefzyklus, kein
-- Tag laenger. Aendert sich die Rechtslage, aendert sich der Default hier —
-- an EINER Stelle, und die Spalte traegt ihn pro Zeile mit.
--
-- Die Frist muss sich SELBST durchsetzen: pg_cron gibt es in diesem Stack
-- nicht (postgres:16-alpine), und eine Frist, die an einem externen Cron
-- haengt, den niemand einrichtet, ist keine Frist (dieselbe Ueberlegung wie
-- 0034:275-280). Deshalb raeumt die Schreibroutine der Middleware gelegentlich
-- mit auf — jeder Betreiber-Zugriff bezahlt also seine eigene Aufraeumung.
-- ----------------------------------------------------------------------------
create or replace function app.purge_operator_audit_log()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  perform pg_catalog.set_config('app.audit_purge', 'on', true);
  delete from app.operator_audit_log where expires_at <= pg_catalog.now();
  get diagnostics v_deleted = row_count;
  perform pg_catalog.set_config('app.audit_purge', 'off', true);
  return v_deleted;
end;
$$;

comment on function app.purge_operator_audit_log() is
  'Setzt die Loeschfrist des Betreiber-Protokolls durch (365 Tage, siehe 0051). Die EINZIGE Stelle, die ueberhaupt Zeilen entfernen kann — und auch sie nur verfallene (der Trigger prueft old.expires_at zusaetzlich selbst).';

-- Nicht fuer jeden aufrufbar: die Routine ist security definer.
revoke all on function app.purge_operator_audit_log() from public;
grant execute on function app.purge_operator_audit_log() to service_role;

commit;
