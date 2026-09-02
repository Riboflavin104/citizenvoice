-- ============================================================
-- Migration: authority role support
-- Run this in Supabase SQL Editor AFTER your original schema.sql
-- ============================================================

-- 1. Add the flag. Defaults to false — everyone starts as a regular citizen.
alter table profiles add column if not exists is_authority boolean default false;

-- 2. Let authorities view ALL complaints (not just their own) directly via
-- Supabase if ever needed — mirrors what our backend endpoint will also do.
create policy "authorities can view all complaints"
    on complaints for select
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.is_authority = true
        )
    );

-- 3. Let authorities update any complaint's status directly via Supabase too.
create policy "authorities can update complaint status"
    on complaints for update
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.is_authority = true
        )
    );

-- ============================================================
-- 4. Promote your test account to an authority (manual, one-time).
-- Replace the email with your actual test account, then run this line alone.
-- ============================================================
-- update profiles set is_authority = true
-- where id = (select id from auth.users where email = 'youremail@example.com');
