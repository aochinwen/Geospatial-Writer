-- Create Projects Table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

-- Enable RLS on Projects
alter table public.projects enable row level security;

-- Policies for Projects (Users can only see/edit their own projects)
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);

create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- Create Features Table
create table public.features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade not null,
  geometry jsonb not null,
  properties jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Enable RLS on Features
alter table public.features enable row level security;

-- Policies for Features (Inherit access from project)
-- Note: A simplified approach is to check if the user owns the project.
-- Since we are querying features by project_id, we can check via a join or existing RLS on the parent.
-- For standard CRUD, we'll verify the project belongs to the user.

create policy "Users can view features of own projects" on public.features
  for select using (
    exists (
      select 1 from public.projects
      where public.projects.id = public.features.project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can insert features to own projects" on public.features
  for insert with check (
    exists (
      select 1 from public.projects
      where public.projects.id = public.features.project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can update features of own projects" on public.features
  for update using (
    exists (
      select 1 from public.projects
      where public.projects.id = public.features.project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can delete features of own projects" on public.features
  for delete using (
    exists (
      select 1 from public.projects
      where public.projects.id = public.features.project_id
      and public.projects.user_id = auth.uid()
    )
  );
