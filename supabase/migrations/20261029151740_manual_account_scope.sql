-- Manual passwords do not prove ownership of an email address. Restrict those
-- identities to the exact assignment authorized when the account was created.
-- Ordinary email-verified accounts retain the existing acceptance behavior.
create or replace function private.accept_staff_invitations() returns integer
language plpgsql security definer set search_path='' as $$
declare user_email text; manual_scope text; invitation record; accepted integer:=0; current_owner uuid;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select lower(email),raw_app_meta_data->>'manual_invitation_id' into user_email,manual_scope
 from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if user_email is null then return 0; end if;
 for invitation in select * from public.staff_invitations
 where email=user_email and accepted_at is null and revoked_at is null and expires_at>now()
 and (manual_scope is null or id::text=manual_scope)
 order by gym_id,id for update loop
  select owner_id into current_owner from public.gyms where id=invitation.gym_id for update;
  if invitation.kind='manager' then
   if not exists(select 1 from private.platform_admins where user_id=invitation.invited_by) then continue; end if;
   update public.gyms set owner_id=auth.uid(),
    trial_started_at=case when lifecycle='pending' then now() else trial_started_at end,
    trial_ends_at=case when lifecycle='pending' then now()+interval '7 days' else trial_ends_at end,
    lifecycle=case when lifecycle='pending' then 'trial' else lifecycle end where id=invitation.gym_id;
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
-- No new table, global role, grant or operational fixture is added.
