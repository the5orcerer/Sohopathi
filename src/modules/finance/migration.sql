-- Finance module migration: ensure title and timestamps exist on fee_invoice table
alter table public.fee_invoice add column if not exists title text not null default 'Tuition Fee';
alter table public.fee_invoice add column if not exists created_at timestamptz not null default now();
do $$
begin
  alter table public.fee_invoice alter column academic_year_id drop not null;
exception
  when others then null;
end $$;

