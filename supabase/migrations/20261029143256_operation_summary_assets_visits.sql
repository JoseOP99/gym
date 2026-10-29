-- Additive migration: no historical sales or real operational data are rewritten.
alter table public.machines add column asset_value bigint
  check (asset_value between 0 and 10000000000);
grant update(asset_value) on public.machines to authenticated;

create index sales_client_visits_idx on public.sales(gym_id,client_id,opened_at desc)
  where kind='visit';

create or replace function private.open_sale(g uuid,c uuid,charge_pass boolean,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; price bigint; existing public.sales; day_start timestamptz;
begin
 if not private.allowed(g,array['owner','reception']) then raise exception 'No autorizado'; end if;
 -- Serialize requests for the same client, including concurrent reception desks.
 select name into n from public.clients where id=c and gym_id=g and active for update;
 if n is null then raise exception 'Cliente no disponible'; end if;
 select * into existing from public.sales where id=request_id;
 if found then
  if existing.gym_id<>g or existing.created_by<>auth.uid() or existing.client_id is distinct from c then raise exception 'Solicitud inválida'; end if;
  return request_id;
 end if;
 day_start:=date_trunc('day',now() at time zone 'America/Bogota') at time zone 'America/Bogota';
 -- An unpaid older account must also be continued rather than duplicated.
 select * into existing from public.sales
 where gym_id=g and client_id=c and kind='visit'
   and (status='open' or (opened_at>=day_start and opened_at<day_start+interval '1 day'))
 order by (status='open') desc,opened_at desc,id limit 1;
 if found then return existing.id; end if;
 insert into public.sales(id,gym_id,client_id,client_name,created_by) values(request_id,g,c,n,auth.uid());
 if charge_pass then
  select daily_price into price from public.gyms where id=g;
  insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price) values(g,request_id,'Pase diario',1,price);
 end if;
 return request_id;
end $$;

create function private.finance_summary(g uuid,period text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare first_day date; today date:=(now() at time zone 'America/Bogota')::date;
  start_at timestamptz; end_at timestamptz; result jsonb;
begin
 if not private.allowed(g,array['owner']) then raise exception 'No autorizado'; end if;
 if period is null or period not in ('day','week','month') then raise exception 'Período inválido'; end if;
 first_day:=case period when 'day' then today when 'week' then date_trunc('week',today)::date else date_trunc('month',today)::date end;
 start_at:=first_day::timestamp at time zone 'America/Bogota';
 end_at:=(today+1)::timestamp at time zone 'America/Bogota';
 with paid as (
   select (closed_at at time zone 'America/Bogota')::date as day,sum(total) as amount
   from public.sales where gym_id=g and status='closed' and closed_at>=start_at and closed_at<end_at group by 1
 ), cash as (
   select (created_at at time zone 'America/Bogota')::date as day,
     coalesce(sum(amount) filter(where direction='income'),0) as income,
     coalesce(sum(amount) filter(where direction='expense'),0) as expenses
   from public.cash_entries where gym_id=g and created_at>=start_at and created_at<end_at group by 1
 ), days as (
   select first_day+i as day from generate_series(0,today-first_day) i
 )
 select jsonb_build_object(
   'starts_on',first_day,'ends_on',today,
   'sales',coalesce((select sum(amount) from paid),0),
   'income',coalesce((select sum(income) from cash),0),
   'expenses',coalesce((select sum(expenses) from cash),0),
   'assets',(select coalesce(sum(asset_value),0) from public.machines where gym_id=g and status<>'retired'),
   'unvalued',(select count(*) from public.machines where gym_id=g and status<>'retired' and asset_value is null),
   'days',(select jsonb_agg(jsonb_build_object('day',d.day,'income',coalesce(p.amount,0)+coalesce(c.income,0),'expenses',coalesce(c.expenses,0)) order by d.day)
     from days d left join paid p on p.day=d.day left join cash c on c.day=d.day)
 ) into result;
 return result;
end $$;
create function public.finance_summary(g uuid,period text)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.finance_summary(g,period) $$;
revoke all on function private.finance_summary(uuid,text),public.finance_summary(uuid,text) from public,anon;
grant execute on function private.finance_summary(uuid,text),public.finance_summary(uuid,text) to authenticated;
-- Rollback, if needed: restore private.open_sale from the previous migration;
-- remove the two finance_summary functions, index, and asset_value column only
-- after exporting any values recorded after this deployment.
