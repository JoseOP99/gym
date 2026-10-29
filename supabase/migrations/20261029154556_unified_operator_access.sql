-- One effective operational role. Preserve historical enum values and rates;
-- no staff, invitation, sales or other operational rows are rewritten.
create function private.operator_role_matches(actual text, requested text[])
returns boolean language sql immutable set search_path='' as $$
 select coalesce(actual=any(array['reception','inventory','instructor'])
   and requested && array['reception','inventory','instructor'],false);
$$;
revoke all on function private.operator_role_matches(text,text[]) from public,anon,authenticated;

create or replace function private.member_of(g uuid,roles text[] default array['owner','reception','inventory','instructor'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 private.is_platform_admin()
 or exists(select 1 from public.gyms where id=g and owner_id=auth.uid() and 'owner'=any(roles))
 or exists(select 1 from public.staff where gym_id=g and user_id=auth.uid() and active
   and private.operator_role_matches(role::text,roles)));
$$;
-- Existing RLS and RPCs use member_of through private.allowed. Owner-only
-- arrays remain owner-only: finances, staff, settings and archive/retire guards.
-- Trial/tenant checks, immutable closed sales and table DELETE grants are unchanged.
