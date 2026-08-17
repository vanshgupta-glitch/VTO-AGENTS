-- 0005_leases.sql — a generic lease table for singleton services (the dispatcher must be a singleton:
-- two dispatchers double-create stage tasks). Idempotent.

create table if not exists leases (
  name       text primary key,
  holder     text not null,
  expires_at timestamptz not null
);

-- Try to acquire/renew a named lease for `p_holder` for `p_ttl_secs`. Returns TRUE iff the caller now
-- holds an unexpired lease. If another holder's lease is still valid, the row is left untouched and the
-- function returns FALSE (the caller is a standby). On holder death the lease expires and a standby wins.
create or replace function vto_acquire_lease(p_name text, p_holder text, p_ttl_secs int)
  returns boolean language plpgsql as $$
declare v_ok boolean;
begin
  insert into leases (name, holder, expires_at)
  values (p_name, p_holder, now() + (p_ttl_secs || ' seconds')::interval)
  on conflict (name) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where leases.holder = excluded.holder or leases.expires_at < now();
  select (holder = p_holder and expires_at > now()) into v_ok from leases where name = p_name;
  return coalesce(v_ok, false);
end;
$$;
