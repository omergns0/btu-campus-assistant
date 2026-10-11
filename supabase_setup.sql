-- ============================================================
-- BTÜ Kampüs Asistanı – Supabase Veritabanı Kurulumu
-- Supabase panelinde: SQL Editor → New query → bu dosyayı yapıştır → Run
-- ============================================================

-- Kullanıcıların ders taslaklarını tutan tablo (her kullanıcıya 1 satır)
create table if not exists public.user_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  courses    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: herkes yalnızca kendi taslağını görebilir/değiştirebilir
alter table public.user_plans enable row level security;

drop policy if exists "Kendi planini okur"      on public.user_plans;
drop policy if exists "Kendi planini ekler"     on public.user_plans;
drop policy if exists "Kendi planini gunceller" on public.user_plans;
drop policy if exists "Kendi planini siler"     on public.user_plans;

create policy "Kendi planini okur"
  on public.user_plans for select
  using (auth.uid() = user_id);

create policy "Kendi planini ekler"
  on public.user_plans for insert
  with check (auth.uid() = user_id);

create policy "Kendi planini gunceller"
  on public.user_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Kendi planini siler"
  on public.user_plans for delete
  using (auth.uid() = user_id);
