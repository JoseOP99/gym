-- One application, one database. Amounts are integer cents.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create type public.staff_role as enum ('reception','inventory','instructor');
create table public.gyms (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 2 and 100), currency text not null default 'COP' check(currency='COP'),
 timezone text not null default 'America/Bogota' check(timezone='America/Bogota'),
 daily_price bigint not null default 1500000 check(daily_price between 0 and 10000000000),
 monthly_price bigint not null default 10000000 check(monthly_price between 0 and 10000000000),
 created_at timestamptz not null default now()
);
create table public.staff (
 gym_id uuid not null references public.gyms(id), user_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 2 and 100), role public.staff_role not null,
 rate bigint not null default 0 check(rate between 0 and 10000000000), active boolean not null default true,
 primary key(gym_id,user_id)
);
create index staff_user_idx on public.staff(user_id,gym_id) where active;
create function private.allowed(g uuid, roles text[] default array['owner','reception','inventory','instructor'])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 exists(select 1 from public.gyms where id=g and owner_id=auth.uid() and 'owner'=any(roles))
 or exists(select 1 from public.staff where gym_id=g and user_id=auth.uid() and active and role::text=any(roles)));
$$;
revoke all on function private.allowed(uuid,text[]) from public;
grant execute on function private.allowed(uuid,text[]) to authenticated;
alter table public.gyms enable row level security;
alter table public.staff enable row level security;
revoke all on public.gyms,public.staff from anon,authenticated;
grant select,insert on public.gyms to authenticated;
grant update(name,daily_price,monthly_price) on public.gyms to authenticated;
grant select on public.staff to authenticated;
grant update(name,role,rate,active) on public.staff to authenticated;
create policy gym_read on public.gyms for select to authenticated using(private.allowed(id));
create policy gym_create on public.gyms for insert to authenticated with check(owner_id=(select auth.uid()));
create policy gym_edit on public.gyms for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy staff_read on public.staff for select to authenticated using(user_id=(select auth.uid()) or private.allowed(gym_id,array['owner']));
create policy staff_edit on public.staff for update to authenticated using(private.allowed(gym_id,array['owner'])) with check(private.allowed(gym_id,array['owner']));
create table public.clients (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 name text not null check(length(trim(name)) between 2 and 100),
 email text check(email is null or length(email)<=254), phone text check(length(phone)<=30),
 active boolean not null default true, created_at timestamptz not null default now(), unique(gym_id,id)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 name text not null check(length(trim(name)) between 2 and 100),
 price bigint not null check(price between 0 and 10000000000), stock integer not null default 0 check(stock between 0 and 1000000),
 active boolean not null default true, unique(gym_id,id)
);
create table public.machines (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 name text not null check(length(trim(name)) between 2 and 100),
 status text not null default 'available' check(status in ('available','maintenance','retired')),
 notes text not null default '' check(length(notes)<=1000), unique(gym_id,id)
);
create table public.sales (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 client_id uuid, client_name text not null,
 status text not null default 'open' check(status in ('open','closed')),
 kind text not null default 'visit' check(kind in ('visit','membership')),
 total bigint not null default 0 check(total>=0),
 payment_method text check(payment_method in ('cash','transfer','card')),
 created_by uuid not null references auth.users(id), closed_by uuid references auth.users(id),
 opened_at timestamptz not null default now(), closed_at timestamptz,
 unique(gym_id,id), foreign key(gym_id,client_id) references public.clients(gym_id,id),
 check((status='open' and closed_at is null) or (status='closed' and closed_at is not null))
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null, sale_id uuid not null, product_id uuid,
 description text not null, quantity integer not null check(quantity between 1 and 1000),
 unit_price bigint not null check(unit_price>=0),
 foreign key(gym_id,sale_id) references public.sales(gym_id,id),
 foreign key(gym_id,product_id) references public.products(gym_id,id)
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null, client_id uuid not null,
 sale_id uuid not null unique, starts_on date not null, expires_on date not null check(expires_on>starts_on),
 foreign key(gym_id,client_id) references public.clients(gym_id,id),
 foreign key(gym_id,sale_id) references public.sales(gym_id,id)
);
create table public.cash_entries (
 id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id),
 direction text not null check(direction in ('income','expense')),
 description text not null check(length(trim(description)) between 2 and 300),
 amount bigint not null check(amount between 1 and 10000000000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create index clients_gym_idx on public.clients(gym_id,created_at desc);
create index sales_history_idx on public.sales(gym_id,closed_at desc,id) where status='closed';
create index sales_open_idx on public.sales(gym_id,opened_at desc) where status='open';
create index items_sale_idx on public.sale_items(gym_id,sale_id);
create index memberships_expiry_idx on public.memberships(gym_id,client_id,expires_on desc);
create index products_gym_idx on public.products(gym_id);
create index machines_gym_idx on public.machines(gym_id);
create index cash_gym_idx on public.cash_entries(gym_id,created_at desc);
do $$
declare t text; r text[];
begin
 foreach t in array array['clients','products','machines','sales','sale_items','memberships','cash_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  r := case when t in ('products','machines') then array['owner','reception','inventory']
            when t in ('clients','memberships') then array['owner','reception','instructor']
            when t='cash_entries' then array['owner'] else array['owner','reception'] end;
  execute format('create policy read_rows on public.%I for select to authenticated using(private.allowed(gym_id,%L::text[]))',t,r);
 end loop;
 foreach t in array array['clients','products','machines'] loop
  r := case when t='clients' then array['owner','reception'] else array['owner','inventory'] end;
  execute format('grant insert on public.%I to authenticated',t);
  execute format('create policy insert_rows on public.%I for insert to authenticated with check(private.allowed(gym_id,%L::text[]))',t,r);
  execute format('create policy update_rows on public.%I for update to authenticated using(private.allowed(gym_id,%L::text[])) with check(private.allowed(gym_id,%L::text[]))',t,r,r);
 end loop;
end $$;
grant update(name,email,phone,active) on public.clients to authenticated;
grant update(name,price,stock,active) on public.products to authenticated;
grant update(name,status,notes) on public.machines to authenticated;
grant insert on public.cash_entries to authenticated;
create policy cash_insert on public.cash_entries for insert to authenticated with check(private.allowed(gym_id,array['owner']) and created_by=(select auth.uid()));
create function private.add_staff(g uuid, email_address text, display_name text, assigned_role public.staff_role, hourly_rate bigint)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if not private.allowed(g,array['owner']) then raise exception 'No autorizado'; end if;
 select id into u from auth.users where lower(email)=lower(trim(email_address)) and email_confirmed_at is not null;
 if u is null then raise exception 'El usuario debe registrarse y confirmar su correo primero'; end if;
 if exists(select 1 from public.gyms where id=g and owner_id=u) then raise exception 'El propietario ya tiene acceso completo'; end if;
 insert into public.staff(gym_id,user_id,name,role,rate) values(g,u,display_name,assigned_role,hourly_rate)
 on conflict(gym_id,user_id) do update set name=excluded.name,role=excluded.role,rate=excluded.rate,active=true;
end $$;
create function public.add_staff(g uuid,email_address text,display_name text,assigned_role public.staff_role,hourly_rate bigint default 0)
returns void language sql security invoker set search_path='' as $$select private.add_staff(g,email_address,display_name,assigned_role,hourly_rate)$$;
create function private.open_sale(g uuid,c uuid,charge_pass boolean,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; price bigint; existing public.sales;
begin
 if not private.allowed(g,array['owner','reception']) then raise exception 'No autorizado'; end if;
 select * into existing from public.sales where id=request_id;
 if found then
  if existing.gym_id<>g or existing.created_by<>auth.uid() then raise exception 'Solicitud inválida'; end if;
  return request_id;
 end if;
 select name into n from public.clients where id=c and gym_id=g and active;
 if n is null then raise exception 'Cliente no disponible'; end if;
 insert into public.sales(id,gym_id,client_id,client_name,created_by) values(request_id,g,c,n,auth.uid());
 if charge_pass then
  select daily_price into price from public.gyms where id=g;
  insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price) values(g,request_id,'Pase diario',1,price);
 end if;
 return request_id;
end $$;
create function public.open_sale(g uuid,c uuid,charge_pass boolean,request_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.open_sale(g,c,charge_pass,request_id)$$;
create function private.add_item(s uuid,p uuid,q integer)
returns void language plpgsql security definer set search_path='' as $$
declare sale public.sales; product public.products;
begin
 select * into sale from public.sales where id=s for update;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status<>'open' then raise exception 'La venta ya está cerrada'; end if;
 if q is null or q<1 or q>1000 then raise exception 'Cantidad inválida'; end if;
 select * into product from public.products where id=p and gym_id=sale.gym_id and active;
 if not found then raise exception 'Producto no disponible'; end if;
 insert into public.sale_items(gym_id,sale_id,product_id,description,quantity,unit_price)
 values(sale.gym_id,s,p,product.name,q,product.price);
end $$;
create function public.add_item(s uuid,p uuid,q integer)
returns void language sql security invoker set search_path='' as $$select private.add_item(s,p,q)$$;
create function private.remove_item(i uuid)
returns void language plpgsql security definer set search_path='' as $$
declare sale public.sales;
begin
 select s.* into sale from public.sales s join public.sale_items it on it.sale_id=s.id where it.id=i for update of s;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status<>'open' then raise exception 'La venta ya está cerrada'; end if;
 delete from public.sale_items where id=i;
end $$;
create function public.remove_item(i uuid) returns void language sql security invoker set search_path='' as $$select private.remove_item(i)$$;
create function private.close_sale(s uuid,method text)
returns bigint language plpgsql security definer set search_path='' as $$
declare sale public.sales; item record; amount bigint;
begin
 select * into sale from public.sales where id=s for update;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status='closed' then return sale.total; end if;
 if method is null or method not in ('cash','transfer','card') then raise exception 'Medio de pago inválido'; end if;
 select sum(quantity*unit_price) into amount from public.sale_items where sale_id=s;
 if amount is null then raise exception 'Agrega un concepto antes de cerrar'; end if;
 for item in select product_id,sum(quantity)::integer as qty from public.sale_items where sale_id=s and product_id is not null group by product_id order by product_id loop
  update public.products set stock=stock-item.qty where id=item.product_id and gym_id=sale.gym_id and stock>=item.qty and active;
  if not found then raise exception 'Existencias insuficientes; revisa los productos'; end if;
 end loop;
 update public.sales set status='closed',total=amount,payment_method=method,closed_at=now(),closed_by=auth.uid() where id=s;
 return amount;
end $$;
create function public.close_sale(s uuid,method text) returns bigint language sql security invoker set search_path='' as $$select private.close_sale(s,method)$$;
create function private.renew_membership(g uuid,c uuid,method text,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; start_date date; price bigint; existing public.sales;
begin
 if not private.allowed(g,array['owner','reception']) then raise exception 'No autorizado'; end if;
 select name into n from public.clients where id=c and gym_id=g and active for update;
 if not found then raise exception 'Cliente no disponible'; end if;
 select * into existing from public.sales where id=request_id;
 if found then
  if existing.gym_id<>g or existing.client_id<>c or existing.kind<>'membership' then raise exception 'Solicitud inválida'; end if;
  return request_id;
 end if;
 select monthly_price into price from public.gyms where id=g;
 select greatest((now() at time zone 'America/Bogota')::date,coalesce(max(expires_on),(now() at time zone 'America/Bogota')::date)) into start_date from public.memberships where gym_id=g and client_id=c;
 insert into public.sales(id,gym_id,client_id,client_name,created_by,kind) values(request_id,g,c,n,auth.uid(),'membership');
 insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price) values(g,request_id,'Membresía · 30 días',1,price);
 perform private.close_sale(request_id,method);
 insert into public.memberships(gym_id,client_id,sale_id,starts_on,expires_on) values(g,c,request_id,start_date,start_date+30);
 return request_id;
end $$;
create function public.renew_membership(g uuid,c uuid,method text,request_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.renew_membership(g,c,method,request_id)$$;
create function private.protect_closed_sale() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='closed' then raise exception 'Las ventas cerradas son inmutables'; end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger immutable_sales before update or delete on public.sales for each row execute function private.protect_closed_sale();
create function private.protect_closed_items() returns trigger language plpgsql set search_path='' as $$
declare sid uuid;
begin
 sid:=case when TG_OP='DELETE' then old.sale_id else new.sale_id end;
 perform 1 from public.sales where id=sid and status='open' for update;
 if not found then raise exception 'La venta está cerrada'; end if;
 if TG_OP='UPDATE' and new.sale_id<>old.sale_id then raise exception 'No se puede reasignar un concepto'; end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger immutable_items before insert or update or delete on public.sale_items for each row execute function private.protect_closed_items();
-- Only deliberately exposed operations are executable by authenticated users.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname in ('add_staff','open_sale','add_item','remove_item','close_sale','renew_membership') loop
  execute format('revoke all on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on function private.protect_closed_sale(),private.protect_closed_items() from public,anon,authenticated;

