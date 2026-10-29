begin;
insert into auth.users(id,email,email_confirmed_at) values
('60000000-0000-4000-8000-000000000001','fixture-owner@example.invalid',now()),
('60000000-0000-4000-8000-000000000002','fixture-staff@example.invalid',now()),
('60000000-0000-4000-8000-000000000003','fixture-other@example.invalid',now());
insert into public.gyms(id,owner_id,name) values('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Invitations fixture');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.staff_invitations(gym_id,email,name,role) values('70000000-0000-4000-8000-000000000001','fixture-staff@example.invalid','Inventario ficticio','inventory');
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 if public.accept_staff_invitations()<>0 then raise exception 'FAIL: otro correo aceptó invitación'; end if;
 if (select count(*) from public.staff_invitations)<>0 then raise exception 'FAIL: invitaciones visibles a terceros'; end if;
 begin
  insert into public.staff_invitations(gym_id,email,name,role) values('70000000-0000-4000-8000-000000000001','attacker@example.invalid','Intrusión','inventory');
  raise exception 'FAIL: tercero invita personal';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 if public.accept_staff_invitations()<>1 then raise exception 'FAIL: no acepta su invitación'; end if;
 if public.accept_staff_invitations()<>0 then raise exception 'FAIL: aceptación duplicada'; end if;
 if not exists(select 1 from public.staff where gym_id='70000000-0000-4000-8000-000000000001' and user_id=auth.uid() and role='inventory') then raise exception 'FAIL: rol incorrecto'; end if;
 if (select count(*) from public.gyms)<>1 then raise exception 'FAIL: no recibe acceso a su gimnasio'; end if;
end $$;
reset role;
select 'PASS: owner-only invitations, email-bound acceptance, correct role, idempotency' as result;
rollback;
