# Roblox Asset Publisher (Next.js + Supabase)

MVP: Roblox OAuth login (PKCE) → pick creator → upload .rbxm → publish via Open Cloud Assets API → list/search uploaded assets.

## 1) Setup
1. `cp .env.example .env.local` then fill values.
2. Create Supabase table (SQL below).
3. `npm i`
4. `npm run dev`

## 2) Supabase SQL
Run this in Supabase SQL editor:

```sql
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  creator_type text not null check (creator_type in ('USER','GROUP')),
  creator_id text not null,
  asset_name text not null,
  asset_type text not null,
  asset_id bigint,
  operation_path text,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','DONE','ERROR')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists uploads_user_id_idx on public.uploads(user_id);
create index if not exists uploads_created_at_idx on public.uploads(created_at desc);
create index if not exists uploads_asset_name_idx on public.uploads using gin (to_tsvector('simple', asset_name));
```

## Notes
- This repo stores Roblox access/refresh tokens in a signed, httpOnly cookie (JWT). For production, use HTTPS, rotate secrets, and consider encrypting refresh tokens at rest.
