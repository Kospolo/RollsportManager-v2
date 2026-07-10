-- ============================================================================
-- 00_testkit.sql — TAP-style assertion helpers for the SQL security suite.
--
-- Test-only schema: created by run-tests.sh inside the throwaway container,
-- NEVER part of a production migration. All helpers run with INVOKER rights,
-- so assertions executed after SET LOCAL ROLE authenticated/anon really are
-- evaluated as that role (RLS + grants apply).
--
-- Output contract (TAP-like):
--   pass  -> RAISE NOTICE  'ok N - <label>'
--   fail  -> RAISE EXCEPTION 'not ok N - <label> >> <detail>'  (aborts psql
--            via ON_ERROR_STOP, run-tests.sh reports the suite as FAILED)
-- Numbering is a global sequence: sequences do not roll back, so the counter
-- survives the per-testcase BEGIN/ROLLBACK blocks.
-- ============================================================================

begin;

drop schema if exists testkit cascade;
create schema testkit;

create sequence testkit.test_no;

-- pass
create function testkit.ok(p_label text)
returns void
language plpgsql
as $$
begin
  raise notice 'ok % - %', nextval('testkit.test_no'), p_label;
end;
$$;

-- hard fail (aborts the suite)
create function testkit.fail(p_label text, p_detail text)
returns void
language plpgsql
as $$
begin
  raise exception 'not ok % - % >> %', nextval('testkit.test_no'), p_label, p_detail;
end;
$$;

-- assert equality of two bigints (counts etc.)
create function testkit.is_eq(p_label text, p_actual bigint, p_expected bigint)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    perform testkit.fail(p_label, format('got %s, expected %s', p_actual, p_expected));
  end if;
  perform testkit.ok(p_label);
end;
$$;

-- assert that a statement is REJECTED with exactly the given SQLSTATE.
-- 42501 = insufficient_privilege (grant / RLS violation)
-- P0001 = raise_exception (protection triggers)
-- 23514 = check_violation
create function testkit.throws(p_label text, p_sql text, p_sqlstate text)
returns void
language plpgsql
as $$
declare
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  if v_state is null then
    perform testkit.fail(p_label, 'statement succeeded but MUST be rejected');
  elsif v_state <> p_sqlstate then
    perform testkit.fail(p_label,
      format('rejected with sqlstate %s, expected %s', v_state, p_sqlstate));
  end if;
  perform testkit.ok(p_label);
end;
$$;

-- assert that a statement succeeds (positive control)
create function testkit.succeeds(p_label text, p_sql text)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_msg   text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    perform testkit.fail(p_label, format('failed with %s: %s', v_state, v_msg));
  end;
  perform testkit.ok(p_label);
end;
$$;

-- assert that a DML statement affects exactly N rows.
-- "affects 0" is the RLS way of saying "silently filtered" (no error, no-op).
create function testkit.affects(p_label text, p_sql text, p_expected_rows bigint)
returns void
language plpgsql
as $$
declare
  v_n bigint;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  perform testkit.is_eq(p_label, v_n, p_expected_rows);
end;
$$;

-- the helpers must be callable as anon / authenticated / service_role
grant usage on schema testkit to public;
grant usage, select on sequence testkit.test_no to public;
grant execute on all functions in schema testkit to public;

commit;
