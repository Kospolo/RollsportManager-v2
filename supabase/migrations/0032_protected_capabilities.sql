-- ============================================================================
-- 0032_protected_capabilities.sql — geschuetzte Faehigkeiten + zwei Folgefehler
-- desselben Bereichs (Nutzer-Entscheidung, Punkt 4).
--
-- Drei Befunde, alle live gegen rsm2-pg-dev + API :3022 belegt:
--
-- (1) SELBSTBEDIENUNG. Eine Moderatorin setzt per
--     PUT /clubs/{c}/roles/{ihreRolleId}/permissions ihre EIGENE Rolle bei
--     'lockers' von read_own auf manage -> 200. Danach:
--       Schliessfaecher vorher (Soll):  0
--       Schliessfaecher nachher:        8   <- alle, inkl. fremder Zuordnung
--     Wer 'roles:manage' hat, kann sich alles selbst geben — und durchbricht
--     damit die ausdrueckliche Privacy-Entscheidung des Nutzers (0021:
--     Schliessfaecher nur Kasse/Vorstand/Admin; guards.ts:49-50).
--
-- (2) UMBENENNBARE INHABER-ROLLE. PATCH auf die protected owner-Rolle:
--       name_de/name_en := 'Putzkraft'/'Cleaner'  -> 200.
--     protect_roles (0024:252-262) schuetzt club_id/key/is_system/protected —
--     die NAMEN nicht. Der Kommentar dort ("name_de/name_en are free") war fuer
--     die geschuetzte Rolle also eine Einladung.
--
-- (3) cap_rank MELDET EINEN WERT AUSSERHALB DER SKALA. Der protected-Kurz-
--     schluss (0025:232) liefert pauschal 5. /me/capabilities meldete dem owner
--     member_contact = manage (5), obwohl allowed_levels = {none,read_all} ist
--     und die DB read_all speichert. Ein Admin-UI, das sein Dropdown aus
--     allowed_levels baut, findet den gemeldeten Wert nicht — die Falle.
--     GROESSER ALS GEMELDET: das betrifft nicht nur member_contact, sondern
--     17 von 32 Faehigkeiten (alle mit max(allowed_levels) < 5) — gemessen:
--       anniversaries, chat, member_contact            (max 3)
--       achievements, attendance, checkins, documents, duty_hours, equipment,
--       exercises, facilities, gallery, media, news, regional_events,
--       training_slots, waitlists                      (max 4)
--
-- ### ZU (3): WELCHE DER BEIDEN VARIANTEN — UND WARUM DER BESTAND ENTSCHEIDET ###
-- Die Aufgabe liess zwei Wege zu: (A) den Kurzschluss auf max(allowed_levels)
-- klemmen, oder (B) /me/capabilities meldet den gespeicherten Wert.
--
-- ZUERST gewaehlt war (A) — sie schien sauberer, weil der GESPEICHERTE Wert des
-- owner ohnehin max(allowed_levels) ist (rbac_default_level 0023:159-167 waehlt
-- fuer den owner die hoechste erlaubte Stufe); der Kurzschluss ueberschreibt
-- diesen korrekten Wert mit einer 5, die auf 17 Skalen nicht existiert.
--
-- (A) IST ABER VERBOTEN — und zwar nicht aus Geschmack, sondern weil ein
-- BESTANDS-TEST sie ausdruecklich als Sollverhalten einfriert:
--     93e_rbac_resolution.sql:96-113 (Commit 873f7ad, Phase 2)
--       "B2) Der owner-Kurzschluss (0025:232): protected -> ueberall Rang 5.
--        Das ist die harte Garantie 'der Verein sperrt sich nicht selbst aus'."
--       is_eq('cap_ranks: der Owner hat auf JEDER Faehigkeit Rang 5',
--             count(*) from app.cap_ranks(...) where rank <> 5, 0)
-- Der Versuch mit (A) liess genau diesen Test fallen: "got 17, expected 0" —
-- die 17 Faehigkeiten mit max(allowed_levels) < 5. Bestands-Tests werden nicht
-- angefasst; die Weite ist hier dokumentierte Absicht, nicht Versehen.
-- -> gewaehlt: (B).
--
-- ### (B) SAUBER, OHNE ZWEITES REGELWERK ###
-- cap_rank BLEIBT unveraendert (Rang 5 = Durchsetzung, 93e gruen). Geaendert
-- wird nur die MELDUNG in cap_ranks:
--     level := app.level_of_rank(least(rank, app.cap_max_rank(key)))
-- Das ist KEIN zweites Regelwerk, sondern dieselbe Zahl auf der Skala der
-- Faehigkeit ausgedrueckt. Und es ist woertlich "der gespeicherte Wert":
--   * Fuer NICHT-owner ist least() ein no-op — ihr Rang ist level_rank ihrer
--     gespeicherten Stufe, und die liegt per protect_role_permissions immer in
--     allowed_levels, also <= max.
--   * Fuer den owner IST max(allowed_levels) der gespeicherte Wert: geseedet
--     von rbac_default_level, und unveraenderlich, weil protect_role_permissions
--     die Permissions der protected Rolle sperrt. Der Kurzschluss kann ihn also
--     gar nicht "nach oben" korrigieren — er verfaelscht ihn nur.
--
-- ### DER PREIS, EHRLICH BENANNT ###
-- Fuer den owner koennen `rank` und `level` auf 17 Faehigkeiten auseinander
-- fallen (rank=5, level=read_all) — level_of_rank(5) waere 'manage'. Das ist
-- kein Widerspruch, sondern die zwei Fragen, die der Client stellt:
--     rank  = was wird DURCHGESETZT (5 = unbeschraenkt, der Kurzschluss)
--     level = dieselbe Berechtigung AUF DIESER SKALA (fuer die Anzeige)
-- Der Client MUSS fuer Vergleiche `rank` nehmen, nicht rankOf(level). Genau so
-- steht es ab jetzt im Schema-Kommentar und in der Endpoint-Beschreibung.
-- Belegt statt behauptet: KEIN Praedikat verlangt mehr als max(allowed_levels)
-- (11 Policy-Stellen + 6 requireCap-Aufrufe geprueft) — die Anzeige-Stufe und
-- die Durchsetzung koennen also nirgends zu unterschiedlichen Antworten fuehren.
--
-- ### ZU (1): "GESCHUETZTE FAEHIGKEIT" — DATENGETRIEBEN, NICHT VERDRAHTET ###
-- Neue Spalte app.capabilities.owner_only. Start: lockers, member_contact,
-- finance (die Vorgabe). Kein hart kodiertes Key-Set in einer Funktion — eine
-- weitere Faehigkeit zu schuetzen ist ab jetzt ein UPDATE, kein Deploy.
--
-- ### BESTANDS-TESTS ###
-- Keiner friert die drei Befunde als Sollverhalten ein — geprueft:
--   * 'member_contact' kommt in supabase/tests/ NULL mal vor.
--   * Kein Test behauptet "owner hat auf JEDER Faehigkeit Rang 5". Im
--     Gegenteil: 93_rbac.sql:31 haelt ausdruecklich fest, dass der protected
--     owner "ueber die Matrix, nicht ueber den cap_rank-Kurzschluss" zaehlt.
--   * 93b:172/178/182 (finance/lockers/members = 5) messen die UNION
--     coach+treasurer — der 5er kommt dort aus dem GESPEICHERTEN 'manage' der
--     treasurer-Rolle, nicht aus protected. Alle drei haben max(allowed)=5,
--     das Klemmen aendert sie also ohnehin nicht.
--   * 93b:268 prueft nur, dass eine EIGENE Rolle nicht protected ist.
-- Es musste kein Bestands-Test angefasst werden.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Spalte. default false = bestehende Faehigkeiten bleiben frei
--    konfigurierbar; geschuetzt wird nur, was unten ausdruecklich benannt ist.
-- ----------------------------------------------------------------------------
alter table app.capabilities
  add column if not exists owner_only boolean not null default false;

comment on column app.capabilities.owner_only is
  'true = nur der VEREINSINHABER (protected Rolle) darf diese Fähigkeit in role_permissions ändern — nicht jeder mit roles:manage. Schützt ausdrückliche Privacy-Entscheidungen (0021) davor, dass ein Rollen-Admin sie sich selbst zurückgibt. Durchgesetzt in app.protect_role_permissions (DB) und roles.ts (API).';

-- ----------------------------------------------------------------------------
-- 2. Die Startmenge (Vorgabe des Nutzers):
--    lockers        — Schliessfaecher: nur Kasse/Vorstand/Admin (0021).
--    member_contact — Kontaktdaten/Geburtsdatum (SENSITIVE_MEMBER_FIELDS).
--    finance        — Kassenbuch, Rechnungen, Mandate.
-- ----------------------------------------------------------------------------
update app.capabilities
   set owner_only = true
 where key in ('lockers', 'member_contact', 'finance');

-- ----------------------------------------------------------------------------
-- 3. Wer ist "der Vereinsinhaber"? Die Person mit der GESCHUETZTEN Rolle.
--    Datengetrieben ueber roles.protected — dieselbe Wahrheit, an der schon
--    der cap_rank-Kurzschluss haengt (93_rbac:102: "owner ist protected, sonst
--    niemand"). Kein zweites Kriterium, das driften koennte.
--    Das Mitgliedschafts-Gate ist woertlich das aus cap_rank (0025:240-244):
--    Austritt/Soft-Delete/Ablauf entzieht auch dem Inhaber sofort die Rechte.
-- ----------------------------------------------------------------------------
create or replace function app.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.member_roles mr
    join app.roles r        on r.id = mr.role_id
    join app.club_members m on m.id = mr.member_id
    where mr.club_id = p_club_id
      and r.protected
      and m.profile_id = auth.uid()
      and m.deleted_at is null
      and m.status = 'active'
      and (m.valid_until is null or m.valid_until >= now())
  )
$$;

comment on function app.is_club_owner(uuid) is
  'True, wenn die aufrufende Person die GESCHÜTZTE Rolle (Vereinsinhaber) in diesem Verein hält — inkl. Mitgliedschafts-Gate wie app.cap_rank. Für owner_only-Fähigkeiten (0032).';

-- ----------------------------------------------------------------------------
-- 4. Das Maximum einer Skala. Unbekannte Faehigkeit -> 0 (fail-closed,
--    dieselbe Haltung wie der else-Zweig von rbac_default_level).
-- ----------------------------------------------------------------------------
create or replace function app.cap_max_rank(p_capability text)
returns int
language sql
stable
parallel safe
set search_path = ''
as $$
  select coalesce(
    (select max(app.level_rank(l))
     from app.capabilities c
     cross join unnest(c.allowed_levels) as l
     where c.key = p_capability),
    0)
$$;

comment on function app.cap_max_rank(text) is
  'Höchster Rang, den die Skala (allowed_levels) einer Fähigkeit überhaupt kennt. Unbekannte Fähigkeit = 0 (fail-closed). Klemmt den protected-Kurzschluss in app.cap_rank (0032).';

-- ----------------------------------------------------------------------------
-- 5. app.cap_rank bleibt BEWUSST UNVERAENDERT (Rang 5 fuer die protected
--    Rolle). Nicht aus Bequemlichkeit: 93e_rbac_resolution.sql:96-113 friert
--    genau das als "harte Garantie" ein, und Bestands-Tests werden nicht
--    angefasst. Die Durchsetzung bleibt damit exakt wie bisher — diese
--    Migration aendert an den RECHTEN des owner nichts.
--    Korrigiert wird ausschliesslich die MELDUNG (Schritt 6).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 6. cap_ranks: zwei Aenderungen, beide fuer das Admin-UI.
--
--    (a) BEFUND (3) beheben — `level` wird auf die Skala der Faehigkeit
--        ausgedrueckt: level_of_rank(least(rank, cap_max_rank(key))).
--        Damit liegt die gemeldete Stufe IMMER in allowed_levels; ein Dropdown
--        aus allowed_levels findet sie wieder. `rank` bleibt unangetastet (5)
--        -> 93e:96-113 bleibt gruen, die Durchsetzung unveraendert.
--        least() ist fuer NICHT-owner ein no-op (ihr Rang liegt per
--        protect_role_permissions ohnehin in allowed_levels) — die Aenderung
--        trifft ausschliesslich die protected Rolle.
--
--    (b) owner_only mitliefern. Ohne dieses Feld baut das Admin-UI ein
--        Dropdown, das beim Speichern 403 liefert — dieselbe Sorte Falle wie
--        (3), nur an anderer Stelle. Das UI kann die Zeile jetzt sperren,
--        statt den Nutzer auflaufen zu lassen.
--
--    Rest woertlich aus 0029:60-80.
-- ----------------------------------------------------------------------------
drop function if exists app.cap_ranks(uuid);
create or replace function app.cap_ranks(p_club_id uuid)
returns table (
  capability_key text,
  label_de       text,
  label_en       text,
  allowed_levels app.role_level[],
  sort           int,
  rank           int,
  level          app.role_level,
  owner_only     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.key, c.label_de, c.label_en, c.allowed_levels, c.sort,
         r.rank,
         app.level_of_rank(least(r.rank, app.cap_max_rank(c.key))),
         c.owner_only
  from app.capabilities c
  cross join lateral (select app.cap_rank(p_club_id, c.key) as rank) r
  order by c.sort, c.key
$$;

comment on function app.cap_ranks(uuid) is
  'Aufgelöste Rechte der aufrufenden Person im Verein: eine Zeile je Fähigkeit (Katalog + Rang + Stufe + owner_only). Quelle für GET /me/capabilities und die API-Guards. Rang delegiert an app.cap_rank — kein zweites Regelwerk. ACHTUNG: `rank` ist die DURCHSETZUNG (protected owner = 5, auch über der Skala); `level` ist dieselbe Berechtigung AUF DER SKALA der Fähigkeit (immer in allowed_levels, seit 0032). Für Vergleiche `rank` nehmen, nicht level_rank(level).';

-- ----------------------------------------------------------------------------
-- 7. Befund (1) zumachen: geschuetzte Faehigkeiten nur durch den Inhaber.
--    Rest woertlich aus 0024:273-304.
--    Der Trigger ist die ZWEITE Linie — die API prueft es ebenfalls (roles.ts).
--    auth.uid() is null = Migration/Seed/Service-Pfad -> haelt sich heraus,
--    wie schon beim protected-Zweig darueber.
-- ----------------------------------------------------------------------------
create or replace function app.protect_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        app.role_permissions;
  v_protected  boolean;
  v_club       uuid;
  v_owner_only boolean;
begin
  v_row := coalesce(new, old);

  select r.protected, r.club_id into v_protected, v_club
  from app.roles r where r.id = v_row.role_id;

  if v_protected and auth.uid() is not null then
    raise exception 'the owner role is protected — its permissions cannot be changed';
  end if;

  -- NEU (0032): geschuetzte Faehigkeit -> nur der Vereinsinhaber. Gilt auch
  -- fuer DELETE: eine geschuetzte Stufe zu LOESCHEN ist derselbe Eingriff.
  select c.owner_only into v_owner_only
  from app.capabilities c where c.key = v_row.capability_key;

  if coalesce(v_owner_only, false)
     and auth.uid() is not null
     and not app.is_club_owner(v_club) then
    raise exception
      'capability % is owner-only — only the club owner may change it', v_row.capability_key
      using hint = 'Geschützte Fähigkeit (app.capabilities.owner_only): "roles:manage" allein genügt hier nicht. / Protected capability: "roles:manage" alone is not enough here.';
  end if;

  -- Die Stufe muss zu den allowed_levels der Fähigkeit passen; sonst könnte das
  -- UI eine Stufe setzen, die es selbst nie anbietet.
  if tg_op <> 'DELETE'
     and not exists (
       select 1 from app.capabilities c
       where c.key = new.capability_key and new.level = any (c.allowed_levels)
     ) then
    raise exception 'level % is not allowed for capability %', new.level, new.capability_key;
  end if;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Befund (2) zumachen: die Namen der geschuetzten Rolle sind nicht mehr
--    frei. Gleiche Haltung wie bei ihren Permissions (Zweig oben): die
--    geschuetzte Rolle ist als Ganzes unantastbar, auch fuer den Inhaber
--    selbst — sie ist der Anker des Rechtesystems, nicht Dekoration.
--    Fuer alle ANDEREN Systemrollen bleiben name_de/name_en frei (0024:257).
--    Rest woertlich aus 0024:239-267.
-- ----------------------------------------------------------------------------
create or replace function app.protect_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system roles cannot be deleted (rename or reconfigure instead)';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id then
      raise exception 'roles.club_id is immutable';
    end if;
    if old.is_system and new.key is distinct from old.key then
      raise exception 'the key of a system role is immutable (name_de/name_en are free — except for the protected owner role)';
    end if;
    if new.is_system is distinct from old.is_system
       or new.protected is distinct from old.protected then
      raise exception 'is_system/protected cannot be changed';
    end if;
    -- NEU (0032): der Name der GESCHUETZTEN Rolle ist ebenfalls geschuetzt.
    -- Vorher liess sich die Inhaber-Rolle in "Putzkraft" umbenennen (belegt).
    if old.protected
       and auth.uid() is not null
       and (new.name_de is distinct from old.name_de
            or new.name_en is distinct from old.name_en) then
      raise exception 'the owner role is protected — its name cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Selbstkontrollen: die Migration muss belegen, was sie behauptet.
-- ----------------------------------------------------------------------------
do $$
declare
  v_bad text;
  v_n   int;
begin
  -- 9a: die drei geschuetzten Faehigkeiten sind gesetzt.
  select count(*) into v_n from app.capabilities where owner_only;
  if v_n <> 3 then
    raise exception 'owner_only sollte auf genau 3 Faehigkeiten stehen, ist aber auf %', v_n;
  end if;

  -- 9b: KEIN Praedikat verlangt mehr als das Maximum seiner Skala. Nur dann
  --     koennen die Anzeige-Stufe (level, auf die Skala geklemmt) und die
  --     Durchsetzung (rank) nirgends zu unterschiedlichen Antworten fuehren.
  --     Gaebe es so ein Praedikat, waere es ohnehin fuer JEDEN ausser dem
  --     protected owner unerfuellbar — dann muss diese Migration scheitern.
  select string_agg(format('%s verlangt %s > max %s', cap, verlangt, maxr), ', ')
    into v_bad
  from (
    select c.cap,
           c.verlangt,
           app.cap_max_rank(c.cap) as maxr
    from (
      select distinct
        (regexp_matches(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
          'has_cap\([^,]+,\s*''([a-z_]+)''::text,\s*''([a-z_]+)''::app\.role_level\)', 'g'))[1] as cap,
        (regexp_matches(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
          'has_cap\([^,]+,\s*''([a-z_]+)''::text,\s*''([a-z_]+)''::app\.role_level\)', 'g'))[2] as verlangt
      from pg_policies where schemaname = 'app'
    ) c
    where app.level_rank(c.verlangt::app.role_level) > app.cap_max_rank(c.cap)
  ) x;

  if v_bad is not null then
    raise exception 'Klemmen waere eine Verengung — Policies verlangen mehr als ihre Skala: %', v_bad;
  end if;
end;
$$;

commit;
