create view public.current_memberships with (security_invoker=true) as
select distinct on (gym_id,client_id) gym_id,client_id,starts_on,expires_on
from public.memberships order by gym_id,client_id,expires_on desc;
revoke all on public.current_memberships from anon,authenticated;
grant select on public.current_memberships to authenticated;
alter table public.clients add constraint clients_email_format check(email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$');
create index gyms_owner_idx on public.gyms(owner_id);
create index staff_gym_user_idx on public.staff(gym_id,user_id);
create index sales_client_idx on public.sales(gym_id,client_id);
create index sales_created_by_idx on public.sales(created_by);
create index sales_closed_by_idx on public.sales(closed_by);
create index items_product_idx on public.sale_items(gym_id,product_id);
create index memberships_sale_idx on public.memberships(gym_id,sale_id);
create index cash_created_by_idx on public.cash_entries(created_by);
-- Immutable email payload, idempotency key and short claim lease for a trusted scheduled worker.
create table private.reminder_jobs (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 client_id uuid not null, expires_on date not null, email text not null, gym_name text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 claimed_at timestamptz, sent_at timestamptz,
 unique(gym_id,client_id,expires_on),
 foreign key(gym_id,client_id) references public.clients(gym_id,id)
);
alter table private.reminder_jobs enable row level security;
revoke all on private.reminder_jobs from public,anon,authenticated;
create function public.claim_membership_reminders() returns table(id uuid,email text,gym_name text,expires_on date)
language plpgsql security definer set search_path='' as $$
begin
 insert into private.reminder_jobs(gym_id,client_id,expires_on,email,gym_name)
 select m.gym_id,m.client_id,m.expires_on,c.email,g.name
 from public.current_memberships m join public.clients c on c.id=m.client_id and c.gym_id=m.gym_id
 join public.gyms g on g.id=m.gym_id
 where c.active and c.email is not null and m.expires_on=(now() at time zone 'America/Bogota')::date+3
 on conflict(gym_id,client_id,expires_on) do nothing;
 return query
 with candidates as (
 select j.id from private.reminder_jobs j
 where (j.status='pending' or (j.status='sending' and j.claimed_at<now()-interval '10 minutes'))
 and j.expires_on=(now() at time zone 'America/Bogota')::date+3
 and exists(select 1 from public.current_memberships m where m.gym_id=j.gym_id and m.client_id=j.client_id and m.expires_on=j.expires_on)
 order by j.id for update skip locked limit 100
 ), claimed as (
 update private.reminder_jobs j set status='sending',claimed_at=now() from candidates c where j.id=c.id
 returning j.id,j.email,j.gym_name,j.expires_on
 ) select * from claimed;
end $$;
create function public.finish_membership_reminder(job_id uuid,delivered boolean) returns void
language sql security definer set search_path='' as $$
 update private.reminder_jobs set status=case when delivered then 'sent' else 'failed' end,
 sent_at=case when delivered then now() else null end where id=job_id and status='sending';
$$;
revoke all on function public.claim_membership_reminders(),public.finish_membership_reminder(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_membership_reminders(),public.finish_membership_reminder(uuid,boolean) to service_role;

