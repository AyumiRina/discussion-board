-- Emblem Hall v1 schema
-- Apply this file to the Supabase project before setting the app environment variables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
  avatar_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  context text check (context is null or char_length(context) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete restrict,
  reply_id uuid references public.replies(id) on delete restrict,
  emoji text not null check (emoji in ('❤️', '🔥', '⚔️', '🛡️', '✨', '😂')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint reactions_one_target check ((topic_id is not null) <> (reply_id is not null))
);

create index if not exists topics_created_at_idx on public.topics (created_at desc);
create index if not exists topics_author_id_idx on public.topics (author_id);
create index if not exists replies_topic_created_at_idx on public.replies (topic_id, created_at asc);
create index if not exists replies_author_id_idx on public.replies (author_id);
create index if not exists reactions_topic_id_idx on public.reactions (topic_id) where topic_id is not null;
create index if not exists reactions_reply_id_idx on public.reactions (reply_id) where reply_id is not null;

create unique index if not exists reactions_topic_user_emoji_idx
  on public.reactions (topic_id, user_id, emoji)
  where topic_id is not null;

create unique index if not exists reactions_reply_user_emoji_idx
  on public.reactions (reply_id, user_id, emoji)
  where reply_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row execute function public.set_updated_at();

drop trigger if exists replies_set_updated_at on public.replies;
create trigger replies_set_updated_at
before update on public.replies
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.replies enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Guests create their own profile" on public.profiles;
create policy "Guests create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Guests update their own profile" on public.profiles;
create policy "Guests update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Public topics are readable" on public.topics;
create policy "Public topics are readable"
on public.topics for select
to anon, authenticated
using (true);

drop policy if exists "Guests create topics" on public.topics;
create policy "Guests create topics"
on public.topics for insert
to authenticated
with check ((select auth.uid()) = author_id);

drop policy if exists "Authors update topics" on public.topics;
create policy "Authors update topics"
on public.topics for update
to authenticated
using ((select auth.uid()) = author_id and deleted_at is null)
with check ((select auth.uid()) = author_id);

drop policy if exists "Public replies are readable" on public.replies;
create policy "Public replies are readable"
on public.replies for select
to anon, authenticated
using (true);

drop policy if exists "Guests create replies" on public.replies;
create policy "Guests create replies"
on public.replies for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and exists (
    select 1 from public.topics
    where public.topics.id = topic_id and public.topics.deleted_at is null
  )
);

drop policy if exists "Authors update replies" on public.replies;
create policy "Authors update replies"
on public.replies for update
to authenticated
using ((select auth.uid()) = author_id and deleted_at is null)
with check ((select auth.uid()) = author_id);

drop policy if exists "Public reactions are readable" on public.reactions;
create policy "Public reactions are readable"
on public.reactions for select
to anon, authenticated
using (true);

drop policy if exists "Guests add their own reactions" on public.reactions;
create policy "Guests add their own reactions"
on public.reactions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    (topic_id is not null and exists (select 1 from public.topics where id = topic_id and deleted_at is null))
    or
    (reply_id is not null and exists (select 1 from public.replies where id = reply_id and deleted_at is null))
  )
);

drop policy if exists "Guests remove their own reactions" on public.reactions;
create policy "Guests remove their own reactions"
on public.reactions for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.topics;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.replies;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null;
end
$$;
