-- Platform administration is private and cannot be assigned from the browser.
create table private.platform_admins(
 user_id uuid primary key references auth.users(id),
 created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on private.platform_admins from public,anon,authenticated;
create policy no_client_access on private.platform_admins for all to authenticated using(false) with check(false);
-- Initial platform access is provisioned separately for the authorized account.
-- Do not store personal account identifiers in versioned migrations.
alter table public.gyms
 add column lifecycle text not null default 'pending' check(lifecycle in ('pending','trial','active','suspended')),
 add column trial_started_at timestamptz,
 add column trial_ends_at timestamptz,
 add column created_by uuid references auth.users(id),
 add column membership_days integer not null default 30 check(membership_days between 1 and 365),
 add constraint trial_interval_valid check(trial_ends_at is null or (trial_started_at is not null and trial_ends_at>trial_started_at));
update public.gyms set created_by=owner_id,lifecycle='active';
alter table public.gyms alter column created_by set not null;
create index gyms_created_by_idx on public.gyms(created_by);
alter table public.staff_invitations add column kind text not null default 'staff' check(kind in ('staff','manager'));
create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.platform_admins where user_id=auth.uid());
$$;
create function public.platform_access() returns boolean language sql stable security invoker set search_path='' as $$ select private.is_platform_admin(); $$;
revoke all on function private.is_platform_admin(),public.platform_access() from public,anon;
grant execute on function private.is_platform_admin(),public.platform_access() to authenticated;
create function private.gym_enabled(g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gyms where id=g and (lifecycle='active' or (lifecycle='trial' and trial_ends_at>now())));
$$;
create function private.member_of(g uuid,roles text[] default array['owner','reception','inventory','instructor'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 private.is_platform_admin()
 or exists(select 1 from public.gyms where id=g and owner_id=auth.uid() and 'owner'=any(roles))
 or exists(select 1 from public.staff where gym_id=g and user_id=auth.uid() and active and role::text=any(roles)));
$$;
create or replace function private.allowed(g uuid,roles text[] default array['owner','reception','inventory','instructor'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_platform_admin() or (private.gym_enabled(g) and private.member_of(g,roles)));
$$;
revoke all on function private.gym_enabled(uuid),private.member_of(uuid,text[]) from public,anon;
grant execute on function private.gym_enabled(uuid),private.member_of(uuid,text[]) to authenticated;
-- Only José creates gyms; the public signup path never grants platform privileges.
drop policy gym_create on public.gyms;
revoke insert on public.gyms from authenticated;
drop policy gym_read on public.gyms;
create policy gym_read on public.gyms for select to authenticated using(private.member_of(id));
drop policy gym_edit on public.gyms;
create policy gym_edit on public.gyms for update to authenticated using(private.allowed(id,array['owner'])) with check(private.allowed(id,array['owner']));
grant update(membership_days) on public.gyms to authenticated;
drop policy staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using(private.allowed(gym_id,array['owner']) or (user_id=(select auth.uid()) and private.allowed(gym_id)));
drop policy invitation_create on public.staff_invitations;
create policy invitation_create on public.staff_invitations for insert to authenticated with check(private.allowed(gym_id,array['owner']) and kind='staff' and invited_by=(select auth.uid()));
drop policy invitation_revoke on public.staff_invitations;
create policy invitation_revoke on public.staff_invitations for update to authenticated using(private.allowed(gym_id,array['owner']) and (kind='staff' or private.is_platform_admin())) with check(private.allowed(gym_id,array['owner']) and (kind='staff' or private.is_platform_admin()));
create function private.create_trial_gym(gym_name text,manager_name text,manager_email text,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation_id uuid;
begin
 if not private.is_platform_admin() then raise exception 'Solo el superadministrador puede crear gimnasios'; end if;
 if request_id is null then raise exception 'Solicitud inválida'; end if;
 if exists(select 1 from public.gyms where id=request_id) then
  if not exists(select 1 from public.gyms where id=request_id and created_by=auth.uid()) then raise exception 'Solicitud inválida'; end if;
  select id into invitation_id from public.staff_invitations where gym_id=request_id and kind='manager' order by created_at desc limit 1;
  return jsonb_build_object('gym_id',request_id,'invitation_id',invitation_id);
 end if;
 insert into public.gyms(id,name,owner_id,created_by,lifecycle) values(request_id,trim(gym_name),auth.uid(),auth.uid(),'pending');
 insert into public.staff_invitations(gym_id,email,name,role,kind,invited_by)
 values(request_id,lower(trim(manager_email)),trim(manager_name),'reception','manager',auth.uid()) returning id into invitation_id;
 return jsonb_build_object('gym_id',request_id,'invitation_id',invitation_id);
end $$;
create function public.create_trial_gym(gym_name text,manager_name text,manager_email text,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.create_trial_gym(gym_name,manager_name,manager_email,request_id)$$;
create function private.invite_gym_manager(g uuid,manager_name text,manager_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation_id uuid;
begin
 if not private.is_platform_admin() then raise exception 'Solo el superadministrador puede asignar encargados'; end if;
 perform 1 from public.gyms where id=g for update;
 if not found then raise exception 'Gimnasio no disponible'; end if;
 update public.staff_invitations set revoked_at=now() where gym_id=g and accepted_at is null and revoked_at is null
 and (kind='manager' or email=lower(trim(manager_email)));
 insert into public.staff_invitations(gym_id,email,name,role,kind,invited_by)
 values(g,lower(trim(manager_email)),trim(manager_name),'reception','manager',auth.uid()) returning id into invitation_id;
 return invitation_id;
end $$;
create function public.invite_gym_manager(g uuid,manager_name text,manager_email text)
returns uuid language sql security invoker set search_path='' as $$select private.invite_gym_manager(g,manager_name,manager_email)$$;
create function private.set_gym_lifecycle(g uuid,action text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Solo el superadministrador puede gestionar las pruebas'; end if;
 if action is null or action not in ('activate','suspend','trial7') then raise exception 'Acción inválida'; end if;
 update public.gyms set lifecycle=case action when 'activate' then 'active' when 'suspend' then 'suspended' else 'trial' end,
 trial_started_at=case when action='trial7' then now() else trial_started_at end,
 trial_ends_at=case when action='trial7' then now()+interval '7 days' else trial_ends_at end where id=g;
 if not found then raise exception 'Gimnasio no disponible'; end if;
end $$;
create function public.set_gym_lifecycle(g uuid,action text) returns void language sql security invoker set search_path='' as $$select private.set_gym_lifecycle(g,action)$$;
create or replace function private.accept_staff_invitations() returns integer language plpgsql security definer set search_path='' as $$
declare user_email text; invitation record; accepted integer:=0; current_owner uuid;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if user_email is null then return 0; end if;
 for invitation in select * from public.staff_invitations where email=user_email and accepted_at is null and revoked_at is null and expires_at>now() order by gym_id,id for update loop
  select owner_id into current_owner from public.gyms where id=invitation.gym_id for update;
  if invitation.kind='manager' then
   if not exists(select 1 from private.platform_admins where user_id=invitation.invited_by) then continue; end if;
   update public.gyms set owner_id=auth.uid(),
    trial_started_at=case when lifecycle='pending' then now() else trial_started_at end,
    trial_ends_at=case when lifecycle='pending' then now()+interval '7 days' else trial_ends_at end,
    lifecycle=case when lifecycle='pending' then 'trial' else lifecycle end where id=invitation.gym_id;
   -- A manager has the owner role, never a duplicate staff role.
   update public.staff set active=false where gym_id=invitation.gym_id and user_id=auth.uid();
  else
   if not private.gym_enabled(invitation.gym_id) then continue; end if;
   if invitation.invited_by<>current_owner and not exists(select 1 from private.platform_admins where user_id=invitation.invited_by) then continue; end if;
   if current_owner<>auth.uid() then
    insert into public.staff(gym_id,user_id,name,role,rate) values(invitation.gym_id,auth.uid(),invitation.name,invitation.role,invitation.rate)
    on conflict(gym_id,user_id) do update set name=excluded.name,role=excluded.role,rate=excluded.rate,active=true;
   end if;
  end if;
  update public.staff_invitations set accepted_at=now() where id=invitation.id;
  accepted:=accepted+1;
 end loop;
 return accepted;
end $$;
create function private.guard_archive() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME in ('clients','products') then
  if old.active is distinct from new.active and not private.allowed(old.gym_id,array['owner']) then raise exception 'Solo el encargado puede archivar o activar registros'; end if;
 elsif TG_TABLE_NAME='machines' then
  if old.status is distinct from new.status and (new.status='retired' or old.status='retired') and not private.allowed(old.gym_id,array['owner']) then raise exception 'Solo el encargado puede retirar o reactivar máquinas'; end if;
 end if;
 return new;
end $$;
create trigger client_archive_permission before update on public.clients for each row execute function private.guard_archive();
create trigger product_archive_permission before update on public.products for each row execute function private.guard_archive();
create trigger machine_archive_permission before update on public.machines for each row execute function private.guard_archive();
-- RPCs are privileged internally, so enforce the access window on every operational write as well.
create function private.guard_trial_write() returns trigger language plpgsql set search_path='' as $$
declare g uuid;
begin
 g:=case when TG_OP='DELETE' then old.gym_id else new.gym_id end;
 if not private.allowed(g) then raise exception 'El gimnasio no tiene acceso activo. Contacta al administrador de la plataforma'; end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
do $$
declare t text;
begin
 foreach t in array array['clients','products','machines','sales','sale_items','memberships','cash_entries'] loop
  execute format('create trigger trial_write_guard before insert or update or delete on public.%I for each row execute function private.guard_trial_write()',t);
 end loop;
end $$;
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname in ('create_trial_gym','invite_gym_manager','set_gym_lifecycle') loop
  execute format('revoke all on function %s from public,anon',f.sig);
  execute format('grant execute on function %s to authenticated',f.sig);
 end loop;
end $$;
revoke all on function private.guard_archive(),private.guard_trial_write() from public,anon,authenticated;

