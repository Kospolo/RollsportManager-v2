-- ============================================================================
-- 0035_join_code_column_privilege.sql — Der Vereinscode ist ein GEHEIMNIS,
-- also gehoert er hinter ein SPALTENRECHT. Nicht hinter eine Policy.
--
-- ### Der Befund ###
-- app.clubs.join_code wurde bis hierher an JEDES Mitglied ausgeliefert — auch
-- an die Kinder. Die Kette, Glied fuer Glied:
--   * 0002:292-294  clubs_select using (deleted_at is null and app.is_club_member(id))
--                   -> jedes aktive Mitglied liest DIE GANZE ZEILE.
--   * 0001:43       alter default privileges ... grant select ... to authenticated
--                   -> Tabellenrecht = Recht auf ALLE Spalten, heute und kuenftig.
--   * In allen 34 Migrationen: KEIN EINZIGES Spaltenrecht (grant/revoke select (…)).
-- Die API-seitige Redigierung (clubs.ts, JOIN_CODE_VISIBLE) war richtig gemeint,
-- aber sie ist nur eine Bitte an EINEN Leser. Wer per PostgREST, psql oder einer
-- zweiten Route an app.clubs geht, bekam den Code trotzdem.
--
-- ### Warum RLS das grundsaetzlich nicht kann ###
-- RLS ist ein ZEILEN-Filter. Eine Policy beantwortet "welche Zeilen?", niemals
-- "welche Spalten?". Solange clubs_select die Zeile durchlaesst — und das MUSS
-- sie, jedes Mitglied braucht Name/Ort/Einstellungen seines Vereins — ist jede
-- Spalte dieser Zeile lesbar. Ein Geheimnis in einer sonst oeffentlichen Zeile
-- ist ausschliesslich mit Spaltenrechten (oder einer eigenen Tabelle) zu
-- schuetzen. Das hier ist der Spaltenrechts-Weg.
--
-- ### Das Bedrohungsmodell war falsch ###
-- 0034 haertete den Code gegen RATEN: CSPRNG statt vorhersagbar, Ablauf,
-- Widerruf, Drossel. Alles richtig — und alles wirkungslos gegen den Weg, den
-- ein Angreifer tatsaechlich nimmt: er RAET den Code nicht, er RUFT IHN AB.
-- Ein ausgetretener guest_coach, ein Kind, dessen Geraet jemand in die Hand
-- nimmt, ein neugieriges Mitglied mit einem API-Token — ein `select * from
-- app.clubs` genuegte. Gegen einen Abruf hilft kein CSPRNG, nur ein Recht.
--
-- ### Die Postgres-Feinheit, an der das sonst scheitert ###
-- `revoke select (join_code) on app.clubs from authenticated` ALLEIN tut NICHTS,
-- solange das TABELLENrecht select besteht: Tabellenrecht schlaegt Spaltenrecht,
-- Postgres quittiert den Versuch mit einer blossen WARNING und laesst den Code
-- lesbar. Der einzig wirksame Weg ist die Umkehrung:
--     1. revoke select ON THE TABLE   (das Pauschalrecht faellt)
--     2. grant select (nur die harmlosen Spalten)  (Positivliste)
-- Deshalb steht hier eine Positivliste und kein revoke der zwei Spalten.
--
-- ### Nebenwirkung, BEWUSST: die Liste ist ab jetzt Pflicht ###
-- Ohne Tabellenrecht erbt eine SPAETER per `alter table app.clubs add column`
-- angelegte Spalte KEIN Leserecht fuer authenticated — sie ist unsichtbar, bis
-- jemand sie hier eintraegt. Das ist fail-closed und damit die richtige
-- Richtung (ein vergessenes Geheimnis bleibt geheim, statt still zu lecken),
-- aber es ist eine Falle fuer den naechsten Autor. Sie schnappt nicht leise zu:
-- 99e_join_code_column_privilege.sql nagelt die Liste an pg_attribute und
-- schlaegt fehl, sobald eine Spalte dazukommt, die hier nicht steht.
--
-- ### Was NICHT angefasst wird und warum ###
--   * UPDATE bleibt Tabellenrecht. `update app.clubs set join_code = …` (Rotation)
--     und `set city = …` laufen unter withUser weiter; die Schranke dort ist
--     clubs_update (0002:296-299, owner/admin). Ein Spalten-revoke auf UPDATE
--     waere eine zweite, groessere Aenderung mit eigenem Bruch — siehe Bericht.
--   * join_code_expires_at / join_code_revoked_at BLEIBEN lesbar. Sie sind
--     Metadaten ueber den Code, nicht der Code: wer sie kennt, kommt keinen
--     Schritt naeher an einen Beitritt. Und sie werden gebraucht — POST
--     /clubs/{id}/join-code/revoke gibt join_code_revoked_at unter withUser
--     zurueck (registration.ts:414).
--   * service_role behaelt ALLES (0001:45, `grant all … to service_role`).
--     Muss es auch: der Beitritt per Code (registration.ts:151) sucht ueber
--     join_code_normalized und laeuft im Service-Mode. Ohne das braeche der
--     Beitritt — genau das darf hier nicht passieren.
--   * anon hatte nie ein Recht auf app.clubs (0001:38) und bekommt hier keines.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Das Pauschalrecht faellt. Ab hier ist app.clubs fuer authenticated eine
--    Positivliste — ohne diesen Schritt ist Schritt 2 wirkungslos (s.o.).
-- ----------------------------------------------------------------------------
revoke select on app.clubs from authenticated;

-- ----------------------------------------------------------------------------
-- 2. Die Positivliste: alles ausser join_code und join_code_normalized.
--
--    join_code_normalized steht aus DEMSELBEN Grund auf der Sperrliste wie
--    join_code, und das ist keine Vorsicht, sondern zwingend: er ist der Code
--    in Vergleichsform (0034:69). Wer ihn liest, hat den Code — die
--    Crockford-Normalisierung ist eine Tippfehler-Toleranz, keine Einwegfunktion.
--    Ihn offen zu lassen, waere ein Tresor mit einem Fenster daneben.
-- ----------------------------------------------------------------------------
grant select (
  id,
  name,
  short_name,
  city,
  discipline,
  founded_year,
  settings,
  created_at,
  updated_at,
  deleted_at,
  join_code_expires_at,
  join_code_revoked_at
) on app.clubs to authenticated;

comment on column app.clubs.join_code_normalized is
  'Vergleichsform des Einladungscodes (Crockford-normalisiert, 0034). GEHEIM wie join_code selbst: die Normalisierung ist Tippfehler-Toleranz, keine Einwegfunktion — wer sie liest, hat den Code. Kein Leserecht fuer authenticated (0035), Zugriff nur im Service-Mode.';

-- ----------------------------------------------------------------------------
-- 3. Der einzige Weg fuer authenticated an den Code: app.club_join_code().
--
-- ### Warum eine Funktion und nicht "die API macht das schon"? ###
-- Genau dieses Vertrauen war der Fehler. Das Recht muss dort sitzen, wo die
-- Daten sitzen: security definer + eigener Gate, damit die Antwort auch dann
-- stimmt, wenn jemand die API umgeht.
--
-- ### Warum has_cap('members','manage') und keine Rollenliste? ###
-- Eine Liste array['owner','admin','moderator'] waere ein ZWEITES Regelwerk
-- neben dem Katalog (capabilities.ts warnt genau davor) und liefe beim naechsten
-- Regelwechsel auseinander. has_cap loest ueber app.cap_rank auf: Mehrfachrollen
-- als Vereinigung, Mitgliedschafts-Gate (deleted_at/status/valid_until) aus
-- 0025 inklusive, und je Verein konfigurierbar. Sachlich ist es dieselbe Aussage
-- wie "wer den Roster verwaltet, verwaltet auch die Eintrittskarte".
--   ACHTUNG, echte Verschiebung: members:manage = app.can_manage_members
--   (0007:125) = owner/admin/moderator/TREASURER. Die alte API-Redigierung
--   liess den treasurer NICHT an den Code. Er darf Mitglieder anlegen und
--   aendern — dann ist der Beitrittscode kein sinnvolles Geheimnis vor ihm.
--
-- ### Warum 42501 und keine leere Antwort? ###
-- Ein Recht, das schweigt, ist nicht pruefbar. 42501 ist der Code, den auch RLS
-- wirft, die API bildet ihn auf 403 ab (middleware/error.ts:71) — und ein Test
-- kann ihn festnageln (testkit.throws).
-- Ein NICHT-Mitglied bekommt dieselbe 42501: has_cap ist fuer ihn false. Kein
-- Orakel, ob es den Verein gibt.
-- ----------------------------------------------------------------------------
create or replace function app.club_join_code(p_club_id uuid)
returns table (
  club_id              uuid,
  join_code            text,
  join_code_expires_at timestamptz,
  join_code_revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.has_cap(p_club_id, 'members', 'manage') then
    raise exception
      'app.club_join_code: Mitglieder-Verwaltung (members:manage) erforderlich / members:manage required'
      using errcode = '42501';
  end if;

  return query
    select c.id, c.join_code, c.join_code_expires_at, c.join_code_revoked_at
    from app.clubs c
    where c.id = p_club_id
      and c.deleted_at is null;
end;
$$;

comment on function app.club_join_code(uuid) is
  'Der Vereinscode fuer Code-Verwalter — der EINZIGE Weg fuer authenticated an app.clubs.join_code (das Leserecht auf die Spalte ist seit 0035 entzogen). Gate: app.has_cap(club, ''members'', ''manage''), sonst 42501. security definer, weil das Spaltenrecht sonst auch den Berechtigten sperrte; der Gate ersetzt es exakt.';

revoke all on function app.club_join_code(uuid) from public;
grant execute on function app.club_join_code(uuid) to authenticated, service_role;

commit;
