-- =============================================================================
-- 0041 — DIE NAHT: EIN Vereinscode-Weg statt zwei nebeneinander.
--
-- Diese Migration entsteht NICHT aus einem neuen Befund, sondern aus dem
-- Zusammenfuehren zweier Truppen, die dasselbe Geheimnis gleichzeitig und
-- unabhaengig voneinander bewacht haben. Beide Loesungen sind fuer sich
-- richtig; nebeneinander sind sie ein Fehler:
--
--   0035 (Trupp 1): Leserecht auf app.clubs.join_code entzogen, Zugang nur
--                   ueber app.club_join_code() — Gate: has_cap('members',
--                   'manage') = app.can_manage_members (0007:125)
--                   = owner/admin/moderator/TREASURER.
--   0037 (Trupp 2): app.club_join_codes wird die WAHRHEIT (N Codes, damit
--                   Rotation ein Ueberlappungsfenster haben kann). RLS dort:
--                   club_join_codes_select = has_club_role(owner/admin/
--                   moderator) — OHNE treasurer.
--
-- Ergebnis vor dieser Migration: ZWEI QUELLEN (app.clubs.join_code als
-- Spiegel vs. app.club_join_codes als Wahrheit) und ZWEI GATES, die sich beim
-- treasurer widersprechen. Wer per Route liest, bekommt den Code als
-- treasurer; wer per SQL auf die Wahrheitstabelle liest, nicht. Ein
-- Geheimnis mit zwei Schloessern, die verschieden aufgehen, hat kein Schloss.
--
-- -----------------------------------------------------------------------------
-- ENTSCHEIDUNG 1 — DAS GATE: owner/admin/moderator. Der treasurer bleibt drau
-- ssen.
-- -----------------------------------------------------------------------------
-- Trupp 1 hat den treasurer BEWUSST aufgenommen und begruendet
-- (99e_join_code_column_privilege.sql:187-193): "members:manage =
-- can_manage_members ... Wer Mitglieder anlegen darf, vor dem ist der
-- Beitrittscode kein sinnvolles Geheimnis."
--
-- Die Praemisse stimmt nicht. Nachgelesen statt geraten:
--
--   0002:321-323  create policy club_members_insert on app.club_members
--                   for insert to authenticated
--                   with check (app.has_club_role(club_id, array['owner','admin']));
--
-- Mitglieder anlegen darf owner/admin — NICHT der treasurer. Die Quelle des
-- Irrtums ist ein KOMMENTAR im Katalog (0023:171: "club_members_insert/update
-- = can_manage_members"), der der Policy widerspricht. Der Code gilt, nicht
-- der Kommentar.
--
-- Damit dreht sich Trupp 1s eigenes Argument um: Der Beitrittscode ist fuer
-- den treasurer sehr wohl ein sinnvolles Geheimnis — er ist der EINZIGE Weg,
-- auf dem er Menschen in den Verein braechte. Ihn zu geben, waere eine echte
-- Rechteausweitung ueber den Stand vor 0035 hinaus (die alte Redigierung
-- JOIN_CODE_VISIBLE liess owner/admin/moderator durch). Ein Zusammenfuehren
-- ist nicht der Ort, einer Rolle eine Faehigkeit zu schenken. Im Zweifel
-- strenger.
--
-- Dazu kommt die Unstimmigkeit im Bestand: rotate/revoke verlangen seit je
-- owner/admin/moderator (registration.ts, requireClubRoleDb). Ein treasurer
-- haette den Code LESEN, aber nie rotieren oder widerrufen koennen — er saehe
-- ein Geheimnis, das er nicht einmal einziehen kann, wenn es leckt.
--
-- -----------------------------------------------------------------------------
-- ENTSCHEIDUNG 2 — EIN REGELWERK, nicht zwei Rollenlisten.
-- -----------------------------------------------------------------------------
-- Trupp 1s METHODISCHER Einwand bleibt richtig, auch wenn seine Rollenliste
-- es nicht war: eine handgeschriebene Rollenliste neben dem Katalog ist ein
-- zweites Regelwerk, und zwei Regelwerke driften. Deshalb steht die Regel ab
-- hier GENAU EINMAL — in app.can_read_join_code(). Policy und Funktion rufen
-- dieselbe Zeile. Wer die Regel aendern will, aendert sie hier, und beide
-- Wege folgen; das ist der Grund, warum die Liste NICHT ein zweites Mal in
-- der Policy steht.
--
-- -----------------------------------------------------------------------------
-- ENTSCHEIDUNG 3 — DIE QUELLE: app.club_join_codes.
-- -----------------------------------------------------------------------------
-- app.club_join_code() las bis hier app.clubs.join_code — den SPIEGEL (0037
-- haelt ihn per clubs_mirror_join_code nach). Ein Spiegel als Quelle ist
-- solange harmlos, wie er stimmt, und genau deshalb gefaehrlich: faellt der
-- Trigger, liest die Route still einen veralteten Code, statt laut zu
-- scheitern. Ab hier liest die Funktion die Wahrheitstabelle.
--
-- Der VERTRAG bleibt unveraendert (ClubJoinCode, eine Zeile): geliefert wird
-- der JUENGSTE Code — derselbe, den der Spiegel zeigte. Die N Codes eines
-- Ueberlappungsfensters bleiben damit ohne Oberflaeche; das ist eine bewusst
-- OFFENE Luecke (siehe Bericht), kein Versehen: ein Listen-Endpunkt waere
-- neue, von niemandem geprueffte Vertragsflaeche.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Das eine Regelwerk.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_join_code(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_club_role(p_club_id, array['owner', 'admin', 'moderator'])
$$;

comment on function app.can_read_join_code(uuid) is
  'Wer den Vereinscode sehen darf: owner/admin/moderator — DIE EINZIGE Definition. Sowohl die RLS auf app.club_join_codes (0037) als auch app.club_join_code() (0035) rufen genau diese Funktion; eine zweite Rollenliste daneben gibt es bewusst nicht. Deckungsgleich mit rotate/revoke (registration.ts): wer den Code sieht, kann ihn auch einziehen. Der treasurer ist NICHT dabei — er darf keine Mitglieder anlegen (0002:321-323, owner/admin), der Code waere fuer ihn der einzige Weg in den Verein hinein.';

revoke all on function app.can_read_join_code(uuid) from public;
grant execute on function app.can_read_join_code(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Die RLS folgt dem Regelwerk (statt einer eigenen Liste).
--    Inhaltlich unveraendert gegenueber 0037 — nur die Regel steht nicht mehr
--    ein zweites Mal hier.
-- -----------------------------------------------------------------------------
drop policy if exists club_join_codes_select on app.club_join_codes;
create policy club_join_codes_select on app.club_join_codes
  for select to authenticated
  using (app.can_read_join_code(club_id));

drop policy if exists club_join_codes_update on app.club_join_codes;
create policy club_join_codes_update on app.club_join_codes
  for update to authenticated
  using (app.can_read_join_code(club_id))
  with check (app.can_read_join_code(club_id));

-- -----------------------------------------------------------------------------
-- 3. app.club_join_code(): dasselbe Regelwerk, und die Wahrheit als Quelle.
--
-- security definer bleibt noetig: das Spaltenrecht aus 0035 sperrt sonst auch
-- die Berechtigten aus (app.clubs) — und auf app.club_join_codes wuerde die
-- RLS zwar dasselbe Ergebnis liefern, aber der Gate soll EINE Stelle sein,
-- die laut wird (42501), nicht eine stille 0-Zeilen-Antwort.
-- -----------------------------------------------------------------------------
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
  if not app.can_read_join_code(p_club_id) then
    raise exception
      'app.club_join_code: Vereinscode lesen erfordert owner/admin/moderator / owner/admin/moderator required'
      using errcode = '42501';
  end if;

  -- Die WAHRHEIT ist app.club_join_codes (0037), nicht der Spiegel
  -- app.clubs.join_code. Geliefert wird der juengste Code des Vereins.
  -- Der join auf app.clubs bleibt: ein soft-geloeschter Verein hat keinen
  -- gueltigen Code mehr (und der Aufrufer soll 404 sehen, nicht einen Code).
  return query
    select jc.club_id, jc.code, jc.expires_at, jc.revoked_at
    from app.club_join_codes jc
    join app.clubs c on c.id = jc.club_id
    where jc.club_id = p_club_id
      and c.deleted_at is null
    order by jc.created_at desc, jc.id desc
    limit 1;
end;
$$;

comment on function app.club_join_code(uuid) is
  'Der juengste Vereinscode fuer owner/admin/moderator — der EINZIGE Weg fuer authenticated an einen Klartext-Code, ohne die RLS auf app.club_join_codes zu bemuehen. Gate: app.can_read_join_code() (dieselbe Funktion, die auch die RLS fahrt), sonst 42501. Quelle seit 0041: app.club_join_codes (die Wahrheit), NICHT mehr app.clubs.join_code (der Spiegel) — ein Spiegel als Quelle scheitert still, wenn der Trigger faellt, statt laut. Liefert bewusst nur EINEN Code: die N Codes eines Ueberlappungsfensters haben (noch) keine Oberflaeche.';

revoke all on function app.club_join_code(uuid) from public;
grant execute on function app.club_join_code(uuid) to authenticated, service_role;
