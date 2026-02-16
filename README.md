# Herd Directory PWA

Offline-first progressive web app for browsing total herd inventory records sourced from Supabase (same backend project as your pregnancy checks app).

## Features

- Sync inventory records from Supabase.
- Cache all records in IndexedDB for offline lookup.
- Search by tag, name, breed, lot, status, or pregnancy result.
- Installable PWA with service worker asset caching.

## Supabase configuration (step-by-step)

### 1) Use the same Supabase project as the pregnancy checks app

In the Supabase dashboard:
- Open **Project Settings → API**.
- Copy:
  - **Project URL**
  - **anon public key**

Then update `config.js`:

```js
export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
export const INVENTORY_TABLE = "herd_inventory";
```

### 2) Create / verify the herd inventory table

Use the SQL editor and run:

```sql
create table if not exists public.herd_inventory (
  id bigint generated always as identity primary key,
  tag_number text unique not null,
  name text,
  breed text,
  sex text,
  birth_date date,
  lot text,
  status text,
  pregnancy_result text,
  updated_at timestamptz default now()
);
```

If your pregnancy checks are in another table, keep `pregnancy_result` updated there (trigger/job/manual update) so this directory can show it quickly offline.

### 3) Turn on Row Level Security and allow reads

```sql
alter table public.herd_inventory enable row level security;

create policy "Allow authenticated read herd inventory"
on public.herd_inventory
for select
using (auth.role() = 'authenticated');
```

If this app is used without login, use a `public`-safe read policy instead (only for non-sensitive data):

```sql
create policy "Allow anonymous read herd inventory"
on public.herd_inventory
for select
to anon
using (true);
```

> Keep write policies restricted to authenticated users/admins.

### 4) Confirm data shape matches the app

`app.js` queries these columns:

- `id`
- `tag_number`
- `name`
- `breed`
- `sex`
- `birth_date`
- `lot`
- `status`
- `pregnancy_result`
- `updated_at`

If your schema uses different names, either:
- rename columns in Supabase, or
- update the `.select(...)` query and rendering fields in `app.js`.

### 5) Test sync

1. Start local server.
2. Open app in browser.
3. Click **Sync**.
4. Verify:
   - `Sync status` shows `Synced X records`.
   - records render.
5. Go offline and refresh; cached records should still display.

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.
