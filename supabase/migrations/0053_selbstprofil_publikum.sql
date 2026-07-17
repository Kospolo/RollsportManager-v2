-- ============================================================================
-- 0053_selbstprofil_publikum.sql — das Selbst-Profil (0045) bekommt sein
-- PUBLIKUM. Zwei Stufen, beide INNERHALB des Vereins (nie wirklich oeffentlich —
-- das Datenmodell schliesst das aus, weil ueberwiegend Kinder im System sind):
--
--   'public'   = JEDES aktive Vereinsmitglied sieht das Profil (Motto/Disziplin/
--                seit-wann) auf der Karte.
--   'internal' = NUR Vorstand/Trainer (owner/admin/moderator/coach/guest_coach)
--                sehen es. Andere Mitglieder — auch der treasurer — nicht.
--
-- Immer sichtbar bleibt es fuer die PERSON SELBST und ihre ERZIEHUNGSBERECHTIGTEN
-- (app.can_act_for_member, 0002:192-215) — unabhaengig von der Stufe.
--
-- ### WARUM DIE VORGABE 'internal' IST (fail-safe, nicht bequem) ###
-- Der sichere Weg ist die Vorgabe, nicht die bequeme. 'internal' bedeutet:
-- solange NIEMAND aktiv "oeffentlich" waehlt, wird NICHTS an den ganzen Verein
-- gesendet. Waere 'public' die Vorgabe, wuerde jedes Kind, das ein Motto tippt,
-- es ohne eigene Entscheidung dem ganzen Verein zeigen — genau die
-- gedankenlose Preisgabe, gegen die 0045 die Leitplanke gebaut hat, nur eine
-- Ebene hoeher. Die Richtung der Umkehrbarkeit gibt den Ausschlag (wie in 0045):
-- ein internes Profil oeffentlich zu machen ist ein Klick; ein oeffentliches
-- Profil, das der ganze Verein schon gelesen hat, wieder einzufangen ist keiner.
-- Bei Ungewissheit gewinnt die Richtung, die reparierbar bleibt.
--
-- ### BESTAND: ALLE AUF 'internal' — KEIN BRUCH ###
-- Heute wird das Selbst-Profil NIRGENDS angezeigt (der Design-Lauf baut die
-- Anzeige erst). 'internal' als Startwert entzieht also nichts, was heute
-- sichtbar waere — es setzt nur den fail-safe Ausgangspunkt, bevor die Anzeige
-- landet. `add column ... not null default 'internal'` setzt jede Bestandszeile
-- automatisch auf 'internal'; ein nachtraegliches UPDATE waere ueberfluessig und
-- (bei Wiederholung der Migration) sogar schaedlich — es wuerde eine inzwischen
-- bewusst gesetzte 'public'-Wahl ueberschreiben. Deshalb: nur die Spalte, kein
-- Backfill-UPDATE.
--
-- ### WO DIE STUFE DAS LESEN STEUERT — API-PROJEKTION, NICHT RLS ###
-- Die Durchsetzung sitzt in der API (services/api/src/routes/members.ts,
-- redactSelfProfile) — NICHT in einer RLS-Spaltenlogik. Begruendung:
--   * Die HEUTIGE Roster-Redaktion (birth_date/email/joined_on) sitzt bereits
--     in der API (redactMemberForViewer, maySeeFullRoster/maySeeJoinedOn). Ein
--     Selbst-Profil-Filter in RLS wuerde eine ZWEITE Wahrheit schaffen: die
--     Zeile kaeme aus der DB je nach Mechanismus anders zurueck. Zwei Orte, an
--     denen "wer darf das sehen" entschieden wird, laufen frueher oder spaeter
--     auseinander.
--   * Anders als bei der Anwesenheit (0045 Teil 2, wo das Lesen an einer
--     RLS-Policy hing) gibt es hier keine bestehende Zeilen-Policy, die das
--     Profil verstecken muesste — club_members_select liefert die ganze Zeile
--     an jedes Mitglied. Die Frage ist reine SPALTEN-Projektion (drei Felder
--     nullen), und genau das tut die API schon fuer die Kontaktdaten.
-- Diese Migration liefert deshalb nur die DATENGRUNDLAGE (die Spalte + den
-- Schreibweg + den Urheberschutz). Das SPALTEN-Nullen macht die API.
--
-- ### DER SCHREIBWEG: derselbe wie in 0045, nicht ein zweiter ###
-- profile_visibility wird ueber DENSELBEN Pfad geschrieben wie das Motto:
-- app.set_self_profile (Patch-Schluessel 'visibility'). Und der Urheberschutz
-- app.protect_self_profile behandelt eine Stufen-AENDERUNG wie das Setzen eines
-- Mottos: nur die Person selbst/ihre Vormunde, nur bei status=active. Sonst
-- koennte ein Administrator das Profil eines Kindes von 'internal' auf 'public'
-- schalten und es damit dem ganzen Verein zeigen — das ist dieselbe
-- Identitaetsuebernahme, gegen die 0045 den Trigger gebaut hat, nur ueber die
-- Sichtbarkeit statt ueber den Text. Deshalb: Stufe aendern = Urheberschaft.
-- (Das reine LEEREN eines Mottos bleibt Moderation und weiterhin jedem erlaubt,
--  den die RLS an die Zeile laesst — eine Stufe hat kein "leeren", sie ist immer
--  gesetzt, also ist jede Aenderung an ihr eine bewusste Entscheidung.)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Die Spalte. NOT NULL DEFAULT 'internal' — fail-safe (siehe Kopf).
-- ----------------------------------------------------------------------------
alter table app.club_members
  add column if not exists profile_visibility text not null default 'internal';

alter table app.club_members
  drop constraint if exists club_members_profile_visibility_chk;

alter table app.club_members
  add constraint club_members_profile_visibility_chk
    check (profile_visibility in ('public', 'internal'));

comment on column app.club_members.profile_visibility is
  'Publikum des Selbst-Profils (0053), ZWEI Stufen, beide innerhalb des Vereins: ''public'' = jedes aktive Mitglied sieht Motto/Disziplin/seit-wann; ''internal'' = nur Vorstand/Trainer (owner/admin/moderator/coach/guest_coach), NICHT der treasurer, NICHT andere Mitglieder. Immer sichtbar fuer die Person selbst + Erziehungsberechtigte (can_act_for_member). VORGABE ''internal'' (fail-safe). Durchsetzung des Lesens: API-Projektion members.ts/redactSelfProfile (wie die Kontaktdaten-Redaktion, NICHT RLS). Schreibrecht: nur can_act_for_member + status=active (app.protect_self_profile, app.set_self_profile).';

-- ----------------------------------------------------------------------------
-- 2. Der Waechter aus 0045, ergaenzt: eine Stufen-AENDERUNG ist Urheberschaft.
--    Woertlich 0045/1.3, nur der Sichtbarkeits-Zweig kommt hinzu. Die INSERT-
--    Pruefung bleibt unveraendert: profile_visibility hat einen DEFAULT und ist
--    auf JEDER neuen Zeile gesetzt — sie in den Insert-Block aufzunehmen wuerde
--    jedes Anlegen brechen. Ein neuer Datensatz startet fail-safe auf 'internal'
--    mit leerem Motto; da wird nichts veroeffentlicht.
-- ----------------------------------------------------------------------------
create or replace function app.protect_self_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_touched boolean;
  v_set     boolean;
begin
  if auth.uid() is null then
    return new;  -- service_role: wie 0002, ausdruecklich ausgenommen
  end if;

  if tg_op = 'INSERT' then
    -- Beim INSERT gibt es die Zeile noch nicht, can_act_for_member kann sie
    -- also nicht pruefen. Das Selbst-Profil wird ohnehin NACH dem Beitritt
    -- gepflegt (PATCH), nie beim Anlegen durch die Verwaltung. Fail-closed.
    -- profile_visibility ist hier BEWUSST NICHT geprueft: es hat einen Default
    -- und ist auf jeder Zeile gesetzt; leeres Motto -> nichts veroeffentlicht.
    if new.profile_motto is not null
       or new.profile_favorite_discipline is not null
       or new.profile_skating_since is not null then
      raise exception 'self profile fields cannot be set on insert'
        using hint = 'Das Selbst-Profil pflegt die Person selbst per PATCH /clubs/{clubId}/members/{memberId}/profile.';
    end if;
    return new;
  end if;

  v_touched := new.profile_motto               is distinct from old.profile_motto
            or new.profile_favorite_discipline is distinct from old.profile_favorite_discipline
            or new.profile_skating_since       is distinct from old.profile_skating_since
            -- NEU (0053): auch die Stufe zaehlt zu den Profil-Feldern.
            or new.profile_visibility          is distinct from old.profile_visibility;

  if not v_touched then
    return new;
  end if;

  -- Wird IRGENDEIN Feld auf einen WERT gesetzt (statt geleert)? Dann ist es
  -- Urheberschaft und nur die Person selbst/ihre Vormunde duerfen das.
  -- Reines Leeren (alle beruehrten Textfelder -> NULL) ist Moderation und bleibt
  -- jedem erlaubt, den die RLS ohnehin an die Zeile laesst.
  --
  -- Die Sichtbarkeit hat KEIN "leeren" — sie ist immer gesetzt (NOT NULL).
  -- Jede AENDERUNG an ihr ist damit eine bewusste Entscheidung und zaehlt als
  -- Urheberschaft: ein Administrator soll ein Kind-Profil nicht ohne dessen
  -- Zutun 'public' schalten koennen (siehe Kopf).
  v_set := (new.profile_motto is not null
              and new.profile_motto is distinct from old.profile_motto)
        or (new.profile_favorite_discipline is not null
              and new.profile_favorite_discipline is distinct from old.profile_favorite_discipline)
        or (new.profile_skating_since is not null
              and new.profile_skating_since is distinct from old.profile_skating_since)
        or (new.profile_visibility is distinct from old.profile_visibility);

  if v_set then
    if not app.can_act_for_member(new.id) then
      raise exception 'only the member (or their guardians) may write the self profile'
        using hint = 'app.can_act_for_member: Person selbst oder Erziehungsberechtigte:r laut app.guardianships.';
    end if;
    -- Der pending-Fremde: Antrag ist kein Zutritt (0034). Ohne diesen Filter
    -- haette er ein Feld, das der ganze Verein liest, bevor er aufgenommen ist.
    if new.status <> 'active' then
      raise exception 'only active members may write the self profile'
        using hint = 'Beitrittsantrag laeuft noch (status <> active).';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.protect_self_profile() is
  'Urheberschaft des Selbst-Profils (0045, erweitert 0053): motto/favorite_discipline/skating_since auf einen WERT setzen ODER profile_visibility aendern darf nur app.can_act_for_member (Person selbst oder Vormund) und nur bei status=active. LEEREN eines Textfeldes (auf NULL) darf jede:r, den die RLS an die Zeile laesst — Moderation muss moeglich bleiben, Identitaetsuebernahme (Text ODER Publikum) nicht. service_role (auth.uid() is null) ausgenommen wie in 0002.';

-- ----------------------------------------------------------------------------
-- 3. Der Schreibweg aus 0045, ergaenzt um den Patch-Schluessel 'visibility'.
--    Woertlich 0045/1.4, nur die eine set-Klausel kommt hinzu. Kein zweiter
--    Setzer: das UI schaltet den Umschalter ueber dieselbe Route, mit der es
--    das Motto pflegt (PATCH .../members/{memberId}/profile).
--
--    'visibility' kennt NUR zwei Zustaende (public/internal) und kein "leeren":
--    ein fehlender Schluessel laesst die Stufe stehen, ein Wert setzt sie. Ein
--    ausdrueckliches null im Patch traefe die NOT-NULL-Spalte (23502) — die API
--    laesst es per Schema gar nicht erst zu; die CHECK-Constraint faengt einen
--    ungueltigen String (23514 -> 422).
-- ----------------------------------------------------------------------------
create or replace function app.set_self_profile(p_club_id uuid, p_member_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hit int;
begin
  -- FAIL LOUD STATT STILL (0045): ein doppelt kodierter jsonb-String (statt
  -- eines Objekts) liesse jeden `? 'key'` false werden -> stiller No-Op, 200
  -- mit leerem Profil. Deshalb harte Grenze.
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'set_self_profile: p_patch must be a jsonb OBJECT, got %',
      coalesce(jsonb_typeof(p_patch), 'null')
      using hint = 'Aufrufer: in postgres.js sql.json(obj) verwenden, nicht JSON.stringify(obj) — letzteres kodiert doppelt.';
  end if;

  if not app.can_act_for_member(p_member_id) then
    -- P0001 -> 403 (middleware/error.ts). Dieselbe Antwort wie "Zeile gibt es
    -- nicht": wer fremde Profile schreiben will, soll nicht erfahren, welche
    -- member_id existiert.
    raise exception 'only the member (or their guardians) may write the self profile';
  end if;

  update app.club_members m
     set profile_motto =
           case when p_patch ? 'motto'
                then nullif(p_patch ->> 'motto', '')
                else m.profile_motto end,
         profile_favorite_discipline =
           case when p_patch ? 'favorite_discipline'
                then nullif(p_patch ->> 'favorite_discipline', '')
                else m.profile_favorite_discipline end,
         profile_skating_since =
           case when p_patch ? 'skating_since'
                then (p_patch ->> 'skating_since')::int
                else m.profile_skating_since end,
         -- NEU (0053): der Umschalter. Kein nullif — die Stufe hat kein "leeren".
         profile_visibility =
           case when p_patch ? 'visibility'
                then p_patch ->> 'visibility'
                else m.profile_visibility end
   where m.id = p_member_id
     and m.club_id = p_club_id
     and m.deleted_at is null;

  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'membership not found';
  end if;
end;
$$;

comment on function app.set_self_profile(uuid, uuid, jsonb) is
  'Schreibt AUSSCHLIESSLICH das Selbst-Profil (motto/favorite_discipline/skating_since/visibility) der eigenen Person oder des eigenen Kindes. security definer, weil es fuer Erziehungsberechtigte KEINE UPDATE-Policy auf die Kind-Zeile gibt — eine Vormund-Policy waere ein ZEILEN-Recht und damit ein Eskalationspfad. Diese Funktion kann per Bauart nur vier Spalten. Rechtepruefung: can_act_for_member + Trigger app.protect_self_profile (status=active, Urheberschaft inkl. Stufen-Aenderung). p_patch: fehlender Schluessel = unveraendert, null/'''' = Textfeld loeschen; visibility kennt nur ''public''/''internal'' und kein Leeren.';

commit;
