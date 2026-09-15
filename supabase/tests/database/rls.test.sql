-- Run after applying ../../schema.sql with: supabase test db
-- These contract checks intentionally inspect the migration's public surface;
-- route-level malformed JSON is rejected by the Zod schemas in app/api/**.
begin;

select plan(16);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'topics', 'topics table exists');
select has_table('public', 'replies', 'replies table exists');
select has_table('public', 'reactions', 'reactions table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.topics'::regclass), 'topics has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.replies'::regclass), 'replies has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.reactions'::regclass), 'reactions has RLS enabled');

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'topics' and policyname = 'Public topics are readable'), 1, 'topics expose a public read policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'replies' and policyname = 'Public replies are readable'), 1, 'replies expose a public read policy');
select ok((select pg_get_expr(polqual, polrelid) like '%auth.uid()%' from pg_policy where polname = 'Authors update topics'), 'topic updates are owner-scoped with auth.uid()');
select ok((select pg_get_expr(polqual, polrelid) like '%auth.uid()%' from pg_policy where polname = 'Authors update replies'), 'reply updates are owner-scoped with auth.uid()');

select ok(exists (select 1 from pg_constraint where conrelid = 'public.reactions'::regclass and conname = 'reactions_one_target'), 'reactions require exactly one target');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'reactions_topic_user_emoji_idx'), 'topic reaction uniqueness index exists');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'reactions_reply_user_emoji_idx'), 'reply reaction uniqueness index exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.topics'::regclass and pg_get_constraintdef(oid) like '%char_length(btrim(title))%'), 'topic title length constraint exists');

select * from finish();
rollback;
