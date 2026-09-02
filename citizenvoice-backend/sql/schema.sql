-- ============================================================
-- CitizenVoice — Supabase schema (with real Supabase Auth)
-- Run in Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create extension if not exists vector;

-- 1. Departments
create table if not exists departments (
    id serial primary key,
    name text unique not null,
    description text
);

insert into departments (name, description) values
    ('Water Supply', 'Water leakage, no supply, contamination'),
    ('Electricity', 'Power outage, streetlights, wiring hazards'),
    ('Roads & Infrastructure', 'Potholes, broken roads, bridges'),
    ('Sanitation', 'Garbage collection, sewage, cleanliness'),
    ('Public Safety', 'Crime, accidents, hazards, fire'),
    ('Other', 'Anything that does not fit above')
on conflict (name) do nothing;

-- 2. Profiles table — extends Supabase's built-in auth.users with app-specific fields.
-- Supabase Auth already stores email + hashed password in auth.users; we never
-- touch that table directly. This is the standard "profiles" pattern.
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    phone text,
    created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.profiles (id, full_name, phone)
    values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- 3. Complaints — now linked to a real citizen_id (auth.users.id) instead of free-text name
create table if not exists complaints (
    id uuid primary key default gen_random_uuid(),

    citizen_id uuid references auth.users(id),

    raw_text text not null,
    normalized_text text not null,
    detected_language text default 'en',

    latitude double precision,
    longitude double precision,
    address text,

    photo_url text,          -- public URL from Supabase Storage

    category text,
    department_id int references departments(id),
    classification_confidence float,

    priority_score float default 0,
    priority_label text default 'low',

    embedding vector(384),
    duplicate_of uuid references complaints(id),
    duplicate_count int default 1,

    status text default 'submitted',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists complaint_status_history (
    id serial primary key,
    complaint_id uuid references complaints(id) on delete cascade,
    old_status text,
    new_status text,
    note text,
    changed_at timestamptz default now()
);

create index if not exists idx_complaints_citizen on complaints(citizen_id);
create index if not exists idx_complaints_status on complaints(status);
create index if not exists idx_complaints_category on complaints(category);
create index if not exists idx_complaints_embedding
    on complaints using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 4. Row Level Security — since we now have real users, we turn RLS ON and
-- write real policies instead of disabling it. This is important: it means
-- even if someone got the anon key, they could only ever see/edit their OWN
-- complaints, not everyone's.
alter table complaints enable row level security;
alter table profiles enable row level security;

-- Citizens can insert their own complaints
create policy "citizens can insert own complaints"
    on complaints for insert
    with check (auth.uid() = citizen_id);

-- Citizens can view their own complaints
create policy "citizens can view own complaints"
    on complaints for select
    using (auth.uid() = citizen_id);

-- Citizens can view/update their own profile
create policy "users can view own profile"
    on profiles for select
    using (auth.uid() = id);

create policy "users can update own profile"
    on profiles for update
    using (auth.uid() = id);

-- NOTE: our FastAPI backend uses the service_role key for classification/
-- duplicate-detection writes, which bypasses RLS by design — these policies
-- exist to protect direct frontend-to-Supabase access and any future
-- authenticated-role usage.

-- 5. Duplicate-detection function (same as before)
create or replace function match_similar_complaints (
    query_embedding vector(384),
    match_threshold float default 0.15,
    match_count int default 5,
    exclude_id uuid default null
)
returns table (id uuid, raw_text text, category text, status text, similarity float)
language sql stable
as $$
    select c.id, c.raw_text, c.category, c.status, 1 - (c.embedding <=> query_embedding) as similarity
    from complaints c
    where c.embedding is not null
      and (exclude_id is null or c.id != exclude_id)
      and (c.embedding <=> query_embedding) < match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
$$;

-- ============================================================
-- 6. STORAGE — run this part manually in the dashboard, not SQL:
-- Go to Storage -> New bucket -> name it "complaint-photos" -> Public bucket: ON
-- (Public so photo_url can be viewed directly by authorities without extra auth)
-- ============================================================
