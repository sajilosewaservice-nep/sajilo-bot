-- Supabase schema for TITAN CRM v5

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists operators (
  id bigserial primary key,
  username text unique not null,
  password text not null,
  role text default 'operator',
  created_at timestamp with time zone default now()
);

create type lead_status as enum ('inquiry','pending','working','success','problem');

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  platform text check (platform in ('whatsapp','messenger')) not null,
  customer_name text not null,
  phone text,
  service text not null,
  status lead_status not null default 'inquiry',
  rpa boolean default false,
  summary text,
  note text,
  payment numeric default 0,
  operator_id bigint references operators(id),
  docs boolean default false
);

create table if not exists messages (
  id bigserial primary key,
  lead_id uuid references leads(id) on delete cascade,
  platform text check (platform in ('whatsapp','messenger')) not null,
  sender text,
  recipient text,
  text text not null,
  sent_at timestamp with time zone default now()
);

create table if not exists status_logs (
  id bigserial primary key,
  lead_id uuid references leads(id) on delete cascade,
  prev_status lead_status,
  new_status lead_status not null,
  changed_at timestamp with time zone default now(),
  operator_id bigint references operators(id)
);

-- Sample operator
insert into operators (username, password, role)
values ('admin','password','admin')
on conflict (username) do nothing;
