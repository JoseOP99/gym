-- Read-only checks against the single authorized database. No fixtures or data writes.
begin;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from private.platform_admins order by created_at limit 1),
  'role','authenticated'
)::text,true);
set local role authenticated;
do $$begin
 if not public.platform_access() then raise exception 'FAIL: el administrador configurado no tiene acceso a plataforma'; end if;
 if has_table_privilege('authenticated','public.gyms','INSERT') then raise exception 'FAIL: alta directa de gimnasio permitida'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}',true);
do $$begin
 if public.platform_access() then raise exception 'FAIL: cuenta no asignada tiene plataforma'; end if;
 if (select count(*) from public.gyms)<>0 then raise exception 'FAIL: cuenta no asignada lee gimnasios'; end if;
end $$;
reset role;
do $$begin
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'FAIL: tabla pública sin RLS'; end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgname='trial_write_guard')<>7 then raise exception 'FAIL: falta control de prueba en escrituras'; end if;
end $$;
set local role anon;
do $$begin
 begin perform public.platform_access();raise exception 'FAIL: plataforma ejecutable sin sesión';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.gyms;raise exception 'FAIL: gimnasios visibles sin sesión';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: plataforma, aislamiento básico, privilegios mínimos, RLS y controles de prueba' as result;
rollback;
