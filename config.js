// Use the same Supabase project as your pregnancy checks app.
// Dashboard -> Project Settings -> API
//   - Project URL -> SUPABASE_URL
//   - anon public key -> SUPABASE_ANON_KEY
export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Table queried by app.js for the herd directory.
export const INVENTORY_TABLE = "herd_inventory";

// Minimum expected columns in INVENTORY_TABLE:
// id, tag_number, name, breed, sex, birth_date, lot, status, pregnancy_result, updated_at
