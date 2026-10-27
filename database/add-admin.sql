-- FIRST create a confirmed user in Supabase: Authentication > Users.
-- Replace the placeholder with that user's Auth UUID, then run this query.
insert into public.admins (user_id)
values ('REPLACE_WITH_AUTH_USER_UUID')
on conflict (user_id) do nothing;
-- This grants access to student records. Only add trusted administrators.
