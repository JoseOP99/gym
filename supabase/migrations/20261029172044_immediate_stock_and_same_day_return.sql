-- Transition only when there are no legacy, undeducted open product lines.
-- Locks prevent a concurrent add/close from crossing the rule change.
lock table public.sales, public.sale_items, public.products in access exclusive mode;
do $$ begin
 if exists(select 1 from public.sale_items i join public.sales s on s.id=i.sale_id where s.status='open' and i.product_id is not null) then
  raise exception 'Hay productos pendientes anteriores: conciliar antes de cambiar el descuento de inventario';
 end if;
end $$;
create or replace function private.add_item(s uuid,p uuid,q integer)
returns void language plpgsql security definer set search_path='' as $$
declare sale public.sales; product public.products;
begin
 select * into sale from public.sales where id=s for update;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status<>'open' then raise exception 'La venta ya está cerrada'; end if;
 if q is null or q<1 or q>1000 then raise exception 'Cantidad inválida'; end if;
 update public.products set stock=stock-q where id=p and gym_id=sale.gym_id and active and stock>=q returning * into product;
 if not found then raise exception 'Producto no disponible o existencias insuficientes'; end if;
 insert into public.sale_items(gym_id,sale_id,product_id,description,quantity,unit_price)
 values(sale.gym_id,s,p,product.name,q,product.price);
end $$;
create or replace function private.remove_item(i uuid)
returns void language plpgsql security definer set search_path='' as $$
declare sale public.sales; removed public.sale_items;
begin
 select s.* into sale from public.sales s join public.sale_items it on it.sale_id=s.id where it.id=i for update of s;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status<>'open' then raise exception 'La venta ya está cerrada'; end if;
 delete from public.sale_items where id=i returning * into removed;
 if found and removed.product_id is not null then
  update public.products set stock=stock+removed.quantity where id=removed.product_id and gym_id=sale.gym_id;
 end if;
end $$;
create or replace function private.close_sale(s uuid,method text)
returns bigint language plpgsql security definer set search_path='' as $$
declare sale public.sales; amount bigint;
begin
 select * into sale from public.sales where id=s for update;
 if not found or not private.allowed(sale.gym_id,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if sale.status='closed' then return sale.total; end if;
 if method is null or method not in ('cash','transfer','card') then raise exception 'Medio de pago inválido'; end if;
 select sum(quantity*unit_price) into amount from public.sale_items where sale_id=s;
 if amount is null then raise exception 'Agrega un concepto antes de cerrar'; end if;
 update public.sales set status='closed',total=amount,payment_method=method,closed_at=now(),closed_by=auth.uid() where id=s;
 return amount;
end $$;
-- Active membership covers the entry, not products. Closed sales remain immutable.
create or replace function private.open_sale(g uuid,c uuid,charge_pass boolean,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; price bigint; existing public.sales; day_start timestamptz; covered_until date;
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
 select max(expires_on) into covered_until from public.memberships
 where gym_id=g and client_id=c and starts_on<=(now() at time zone 'America/Bogota')::date
 and expires_on>(now() at time zone 'America/Bogota')::date;
 -- An unpaid older account must also be continued rather than duplicated.
 select * into existing from public.sales
 where gym_id=g and client_id=c and kind='visit'
   and (status='open' or (opened_at>=day_start and opened_at<day_start+interval '1 day'))
 order by (status='open') desc,opened_at desc,id limit 1 for update;
 if found then
  if existing.status='open' and existing.opened_at>=day_start and covered_until is not null then
   update public.sale_items set unit_price=0,description='Ingreso incluido en membresía · vence '||covered_until
   where gym_id=g and sale_id=existing.id and product_id is null and description='Pase diario';
   if not exists(select 1 from public.sale_items where gym_id=g and sale_id=existing.id and product_id is null and description like 'Ingreso incluido en membresía%') then
    insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price)
    values(g,existing.id,'Ingreso incluido en membresía · vence '||covered_until,1,0);
   end if;
  end if;
  if existing.status='closed' then
   return private.open_product_sale(g,c,request_id);
  end if;
  return existing.id;
 end if;
 insert into public.sales(id,gym_id,client_id,client_name,created_by) values(request_id,g,c,n,auth.uid());
 if covered_until is not null then
  insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price)
  values(g,request_id,'Ingreso incluido en membresía · vence '||covered_until,1,0);
 elsif charge_pass then
  select daily_price into price from public.gyms where id=g;
  insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price) values(g,request_id,'Pase diario',1,price);
 end if;
 return request_id;
end $$;
