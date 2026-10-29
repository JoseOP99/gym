begin;
-- Synthetic fixtures only; entire transaction is rolled back.
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000001','owner-a@example.invalid',now()),
('10000000-0000-4000-8000-000000000002','owner-b@example.invalid',now()),
('10000000-0000-4000-8000-000000000003','reception@example.invalid',now()),
('10000000-0000-4000-8000-000000000004','inventory@example.invalid',now());
insert into public.gyms(id,owner_id,name) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Fixture A'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Fixture B');
insert into public.staff(gym_id,user_id,name,role) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Fixture recepción','reception'),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Fixture inventario','inventory');
insert into public.clients(id,gym_id,name) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Cliente ficticio A'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Cliente ficticio B');
insert into public.products(id,gym_id,name,price,stock) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Agua ficticia',300000,10);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$
declare amount bigint; n integer;
begin
 select count(*) into n from public.gyms;
 if n<>1 then raise exception 'FAIL: aislamiento gimnasios'; end if;
 select count(*) into n from public.clients;
 if n<>1 then raise exception 'FAIL: aislamiento clientes'; end if;
 begin
  insert into public.clients(gym_id,name) values('20000000-0000-4000-8000-000000000002','Intrusión');
  raise exception 'FAIL: insert ajeno permitido';
 exception when insufficient_privilege then null; end;
 update public.products set price=1;
 get diagnostics n = row_count;
 if n<>0 then raise exception 'FAIL: recepción cambia precios'; end if;
 begin
  delete from public.clients;
  raise exception 'FAIL: recepción elimina clientes';
 exception when insufficient_privilege then null; end;
 perform public.open_sale('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,'50000000-0000-4000-8000-000000000001');
 perform public.add_item('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',2);
 amount:=public.close_sale('50000000-0000-4000-8000-000000000001','cash');
 if amount<>2100000 then raise exception 'FAIL: total %',amount; end if;
 amount:=public.close_sale('50000000-0000-4000-8000-000000000001','cash');
 if (select stock from public.products where id='40000000-0000-4000-8000-000000000001')<>8 then raise exception 'FAIL: descuento duplicado'; end if;
 begin
  perform public.add_item('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1);
  raise exception 'FAIL: venta cerrada modificable';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 perform public.open_sale('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,'50000000-0000-4000-8000-000000000002');
 perform public.add_item('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',9);
 begin
  perform public.close_sale('50000000-0000-4000-8000-000000000002','cash');
  raise exception 'FAIL: sobreventa';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if (select status from public.sales where id='50000000-0000-4000-8000-000000000002')<>'open' then raise exception 'FAIL: cierre parcial'; end if;
 perform public.renew_membership('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','cash','50000000-0000-4000-8000-000000000003');
 perform public.renew_membership('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','cash','50000000-0000-4000-8000-000000000003');
 if (select count(*) from public.memberships)<>1 then raise exception 'FAIL: renovación duplicada'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.clients)<>0 then raise exception 'FAIL: inventario ve clientes'; end if;
 if (select count(*) from public.sales)<>0 then raise exception 'FAIL: inventario ve ventas'; end if;
 update public.products set stock=9 where id='40000000-0000-4000-8000-000000000001';
 if not found then raise exception 'FAIL: inventario no puede gestionar existencias'; end if;
 begin
  perform public.open_sale('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,gen_random_uuid());
  raise exception 'FAIL: inventario abre ventas';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
reset role;
do $$begin
 begin
  update public.sales set total=1 where id='50000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: trigger inmutabilidad';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
end $$;
set local role anon;
do $$begin
 begin perform count(*) from public.gyms;raise exception 'FAIL: anon lee gimnasios';exception when insufficient_privilege then null;end;
 begin perform public.close_sale('50000000-0000-4000-8000-000000000001','cash');raise exception 'FAIL: anon ejecuta RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: tenant isolation, role permissions, immutable sales, stock rollback, idempotent close and renewal, anonymous denied' as result;
rollback;
