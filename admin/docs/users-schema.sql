-- Run this in Supabase SQL Editor

create table public.users (
  id         uuid not null default gen_random_uuid(),
  email      text not null unique,
  full_name  text not null,
  password   text not null,   -- bcrypt hash
  role       text not null default 'staff'
               check (role in ('admin', 'staff')),
  is_active  boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id)
);

-- Auto-update updated_at on every row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

-- ─── Insert first admin user ──────────────────────────────────
-- 1. Generate bcrypt hash at: https://bcrypt-generator.com  (rounds: 10)
-- 2. Run:

-- insert into public.users (email, full_name, password, role)
-- values ('admin@example.com', 'Admin', '$2b$10$PASTE_HASH_HERE', 'admin');
