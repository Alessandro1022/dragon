-- Dragon — online foundation: profiles, cloud saves, ring-course leaderboard
-- and the breeding exchange ("Avelsbörsen"). Every table has RLS on.

-- Profiles ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "create own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- Cloud saves -----------------------------------------------------------------
create table if not exists public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "own save: read" on public.saves for select using (auth.uid() = user_id);
create policy "own save: insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save: update" on public.saves for update using (auth.uid() = user_id);

-- Ring-course leaderboard -------------------------------------------------------
create table if not exists public.course_times (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  username text not null,
  seconds numeric(7, 2) not null check (seconds > 15),
  created_at timestamptz not null default now()
);
create index if not exists course_times_seconds on public.course_times (seconds);
alter table public.course_times enable row level security;
create policy "times are public" on public.course_times for select using (true);
create policy "submit own time" on public.course_times for insert with check (auth.uid() = user_id);

-- best time per player
create or replace view public.course_leaderboard with (security_invoker = true) as
  select username, seconds, user_id
  from (
    select distinct on (user_id) user_id, username, seconds
    from public.course_times
    order by user_id, seconds asc
  ) best
  order by seconds asc;

-- Breeding exchange -------------------------------------------------------------
-- Players offer an adult dragon as a stud. Others pay gold to breed their own
-- adult with it; the egg is rolled from both public genomes, and the owner
-- collects the gold the next time they log in.
create table if not exists public.stud_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  owner_name text not null,
  dragon_id text not null,
  dragon_name text not null,
  genome jsonb not null,
  element text not null,
  rarity text not null,
  price int not null check (price between 10 and 5000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, dragon_id)
);
create index if not exists stud_listings_active on public.stud_listings (active, created_at desc);
alter table public.stud_listings enable row level security;
create policy "active listings are public" on public.stud_listings for select using (active or auth.uid() = owner_id);
create policy "list own dragon" on public.stud_listings for insert with check (auth.uid() = owner_id);
create policy "manage own listing" on public.stud_listings for update using (auth.uid() = owner_id);
create policy "remove own listing" on public.stud_listings for delete using (auth.uid() = owner_id);

create table if not exists public.stud_payments (
  id bigint generated always as identity primary key,
  listing_id uuid references public.stud_listings on delete set null,
  owner_id uuid not null references auth.users on delete cascade,
  payer_id uuid not null references auth.users on delete cascade,
  amount int not null check (amount > 0),
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.stud_payments enable row level security;
create policy "pay for a stud" on public.stud_payments for insert with check (auth.uid() = payer_id and payer_id <> owner_id);
create policy "see own payments" on public.stud_payments for select using (auth.uid() in (owner_id, payer_id));

-- Owners collect earnings atomically; returns the gold collected.
create or replace function public.claim_stud_earnings()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
begin
  with claimed as (
    update public.stud_payments
       set claimed = true
     where owner_id = auth.uid() and not claimed
    returning amount
  )
  select coalesce(sum(amount), 0) into total from claimed;
  return total;
end;
$$;
grant execute on function public.claim_stud_earnings() to authenticated;
