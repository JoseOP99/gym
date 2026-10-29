create table public.staff_invitations(
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 email text not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' and length(email)<=254),
 name text not null check(length(trim(name)) between 2 and 100), role public.staff_role not null,
 rate bigint not null default 0 check(rate between 0 and 10000000000),
 invited_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, revoked_at timestamptz, last_sent_at timestamptz
);
create unique index invitation_pending on public.staff_invitations(gym_id,email) where accepted_at is null and revoked_at is null;
create index invitation_email_idx on public.staff_invitations(email);
create index invitation_author_idx on public.staff_invitations(invited_by);
alter table public.staff_invitations enable row level security;
revoke all on public.staff_invitations from public,anon,authenticated;
grant select on public.staff_invitations to authenticated;
grant insert(gym_id,email,name,role,rate) on public.staff_invitations to authenticated;
grant update(revoked_at) on public.staff_invitations to authenticated;
grant all on public.staff_invitations to service_role;
create policy invitation_read on public.staff_invitations for select to authenticated using(private.allowed(gym_id,array['owner']));
create policy invitation_create on public.staff_invitations for insert to authenticated with check(private.allowed(gym_id,array['owner']) and invited_by=(select auth.uid()));
create policy invitation_revoke on public.staff_invitations for update to authenticated using(private.allowed(gym_id,array['owner'])) with check(private.allowed(gym_id,array['owner']));
create function private.accept_staff_invitations() returns integer language plpgsql security definer set search_path='' as $$
declare user_email text; invitation record; accepted integer:=0;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if user_email is null then return 0; end if;
 for invitation in select * from public.staff_invitations where email=user_email and accepted_at is null and revoked_at is null and expires_at>now() for update loop
  if not exists(select 1 from public.gyms where id=invitation.gym_id and owner_id=auth.uid()) then
   insert into public.staff(gym_id,user_id,name,role,rate) values(invitation.gym_id,auth.uid(),invitation.name,invitation.role,invitation.rate)
   on conflict(gym_id,user_id) do update set name=excluded.name,role=excluded.role,rate=excluded.rate,active=true;
  end if;
  update public.staff_invitations set accepted_at=now() where id=invitation.id;
  accepted:=accepted+1;
 end loop;
 return accepted;
end $$;
create function public.accept_staff_invitations() returns integer language sql security invoker set search_path='' as $$select private.accept_staff_invitations()$$;
revoke all on function private.accept_staff_invitations(),public.accept_staff_invitations() from public,anon;
grant execute on function private.accept_staff_invitations(),public.accept_staff_invitations() to authenticated;

