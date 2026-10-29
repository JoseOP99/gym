create or replace function private.renew_membership(g uuid,c uuid,method text,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; start_date date; price bigint; duration_days integer; existing public.sales;
begin
 if not private.allowed(g,array['owner','reception']) then raise exception 'No autorizado o prueba finalizada'; end if;
 select name into n from public.clients where id=c and gym_id=g and active for update;
 if not found then raise exception 'Cliente no disponible'; end if;
 select * into existing from public.sales where id=request_id;
 if found then
  if existing.gym_id<>g or existing.client_id<>c or existing.kind<>'membership' then raise exception 'Solicitud inválida'; end if;
  return request_id;
 end if;
 select monthly_price,membership_days into price,duration_days from public.gyms where id=g;
 select greatest((now() at time zone 'America/Bogota')::date,coalesce(max(expires_on),(now() at time zone 'America/Bogota')::date)) into start_date from public.memberships where gym_id=g and client_id=c;
 insert into public.sales(id,gym_id,client_id,client_name,created_by,kind) values(request_id,g,c,n,auth.uid(),'membership');
 insert into public.sale_items(gym_id,sale_id,description,quantity,unit_price)
 values(g,request_id,'Membresía · '||duration_days::text||' días',1,price);
 perform private.close_sale(request_id,method);
 insert into public.memberships(gym_id,client_id,sale_id,starts_on,expires_on) values(g,c,request_id,start_date,start_date+duration_days);
 return request_id;
end $$;

