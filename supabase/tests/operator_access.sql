-- Read-only regression checks; no Auth users, staff or fixtures are inserted.
begin read only;
do $$
declare actual text; target text; t text;
begin
 foreach actual in array array['reception','inventory','instructor'] loop
  foreach target in array array['reception','inventory','instructor'] loop
   if not private.operator_role_matches(actual,array[target]) then
    raise exception 'Missing combined operational permission';
   end if;
  end loop;
  if private.operator_role_matches(actual,array['owner']) then
   raise exception 'Operator elevated to owner';
  end if;
 end loop;
 if private.operator_role_matches('unknown',array['reception']) then
  raise exception 'Unknown role accepted';
 end if;
 foreach t in array array['clients','products','machines','sales'] loop
  if has_table_privilege('authenticated','public.'||t,'DELETE') then
   raise exception 'Operational deletion allowed';
  end if;
 end loop;
end $$;
rollback;
