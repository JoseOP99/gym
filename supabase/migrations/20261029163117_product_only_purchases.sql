-- Subsequent purchases are separate receipts, never changes to a closed sale.
alter table public.sales drop constraint sales_kind_check;
alter table public.sales add constraint sales_kind_check check(kind in ('visit','membership','products'));

create function private.open_product_sale(g uuid,c uuid,request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare n text; existing public.sales;
begin
 if not private.allowed(g,array['owner','reception']) then raise exception 'No autorizado'; end if;
 if request_id is null then raise exception 'Solicitud inválida'; end if;
 select name into n from public.clients where id=c and gym_id=g and active for update;
 if n is null then raise exception 'Cliente no disponible'; end if;
 select * into existing from public.sales where id=request_id;
 if found then
  if existing.gym_id<>g or existing.client_id is distinct from c or existing.created_by<>auth.uid() or existing.kind<>'products' then raise exception 'Solicitud inválida'; end if;
  return request_id;
 end if;
 select * into existing from public.sales where gym_id=g and client_id=c and kind='products' and status='open'
 order by opened_at desc,id limit 1 for update;
 if found then return existing.id; end if;
 insert into public.sales(id,gym_id,client_id,client_name,created_by,kind)
 values(request_id,g,c,n,auth.uid(),'products');
 return request_id;
end $$;
create function public.open_product_sale(g uuid,c uuid,request_id uuid)
returns uuid language sql security invoker set search_path='' as $$select private.open_product_sale(g,c,request_id)$$;
revoke all on function private.open_product_sale(uuid,uuid,uuid),public.open_product_sale(uuid,uuid,uuid) from public,anon;
grant execute on function private.open_product_sale(uuid,uuid,uuid),public.open_product_sale(uuid,uuid,uuid) to authenticated;
