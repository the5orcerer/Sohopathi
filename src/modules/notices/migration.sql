create table if not exists public.notice_read_receipt (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institution(id) on delete cascade,
  notice_id uuid not null references public.notice(id) on delete cascade,
  membership_id uuid not null references public.membership(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (notice_id, membership_id)
);

alter table public.notice_read_receipt enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'notice_read_receipt' and policyname = 'tenant_isolation'
  ) then
    create policy tenant_isolation on public.notice_read_receipt
      using (institution_id = public.current_institution_id());
  end if;
end $$;

create index if not exists idx_notice_read_receipt_institution_id
  on public.notice_read_receipt (institution_id);
