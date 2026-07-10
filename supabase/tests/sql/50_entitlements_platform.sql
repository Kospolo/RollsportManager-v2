-- ============================================================================
-- 50_entitlements_platform.sql — test class (e): entitlements & platform.
--
-- v1 gap: activate_premium was executable by everyone -> self-licensing.
-- v2 rule: entitlements are written EXCLUSIVELY by the API layer
-- (service_role). Clients read their own rows only. The product catalog is
-- read-only for clients and hides inactive products.
-- ============================================================================

begin;

-- fixture (superuser, rolled back at the end): a personal Pro entitlement for
-- Katrin and an inactive product that must stay invisible to clients
insert into app.entitlements (subject_type, subject_id, entitlement, source, provider_ref)
values ('profile', '90000000-0000-4000-8000-000000000009',
        'personal_pro', 'revenuecat', 'test-fixture-personal');

insert into app.products (code, kind, name, price_cents, billing_interval, active)
values ('test_inactive', 'personal_pro', 'Retired product', 100, 'month', false);

-- ---------------------------------------------------------------------------
-- Katrin (member of club A, owns the personal entitlement)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('entitlements: member sees club license + her own personal Pro (2)',
    (select count(*) from app.entitlements), 2);
  perform testkit.is_eq('entitlements: the personal entitlement is her own row',
    (select count(*) from app.entitlements
      where subject_type = 'profile'
        and subject_id = '90000000-0000-4000-8000-000000000009'), 1);
  perform testkit.throws('entitlements (v1 gap): client INSERT (self-licensing) is rejected',
    $q$insert into app.entitlements (subject_type, subject_id, entitlement, source)
       values ('profile', '90000000-0000-4000-8000-000000000009', 'personal_pro', 'manual')$q$,
    '42501');
  perform testkit.throws('entitlements: client UPDATE (extending valid_until) is rejected',
    $q$update app.entitlements set valid_until = now() + interval '10 years'$q$, '42501');
  perform testkit.throws('entitlements: client DELETE is rejected',
    $q$delete from app.entitlements$q$, '42501');
  perform testkit.is_eq('products: catalog is readable, inactive products are hidden (4)',
    (select count(*) from app.products), 4);
  perform testkit.throws('products: client UPDATE of prices is rejected',
    $q$update app.products set price_cents = 0$q$, '42501');
  perform testkit.throws('products: client INSERT into the catalog is rejected',
    $q$insert into app.products (code, kind, name, price_cents)
       values ('free_hack', 'club_license', 'Free for me', 0)$q$, '42501');
end;
$$;

-- ---------------------------------------------------------------------------
-- Stefanie (member of the same club) must NOT see Katrin's personal Pro
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('entitlements: other members see only the club license (1)',
    (select count(*) from app.entitlements), 1);
  perform testkit.is_eq('entitlements: Katrin''s personal Pro is invisible to Stefanie',
    (select count(*) from app.entitlements
      where subject_type = 'profile'
        and subject_id = '90000000-0000-4000-8000-000000000009'), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Club B owner: sees only the OWN club entitlement, and even an owner
-- is just a read-only client here
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('entitlements: club B owner sees exactly the club B entitlement (1)',
    (select count(*) from app.entitlements), 1);
  perform testkit.is_eq('entitlements: club A entitlement is invisible to club B owner',
    (select count(*) from app.entitlements
      where subject_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.throws('entitlements: even a club OWNER cannot write entitlements',
    $q$insert into app.entitlements (subject_type, subject_id, entitlement, source)
       values ('club', 'deadbeef-0000-4000-8000-000000000001', 'club_license', 'manual')$q$,
    '42501');
end;
$$;

-- ---------------------------------------------------------------------------
-- service_role — the ONLY legitimate entitlement writer (webhook service)
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;

do $$
begin
  perform testkit.succeeds('entitlements: service_role (webhook service) MAY insert',
    $q$insert into app.entitlements (subject_type, subject_id, entitlement, source, provider_ref)
       values ('club', 'c1ab0000-0000-4000-8000-000000000001',
               'club_license', 'stripe', 'sub_test_123')$q$);
  perform testkit.affects('entitlements: service_role MAY extend valid_until (1 row)',
    $q$update app.entitlements set valid_until = now() + interval '30 days'
        where provider_ref = 'sub_test_123'$q$, 1);
end;
$$;

rollback;
