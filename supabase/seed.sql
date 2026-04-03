-- Seed data for local development
-- Creates Geoff's seller profile

-- Note: In production, profiles are created via auth triggers.
-- For local dev, we insert directly. The auth.users insert requires
-- supabase local dev running (supabase start).

-- Insert Geoff's profile (requires matching auth.users entry)
-- When using Supabase local dev, create the user via the dashboard
-- at http://localhost:54323, then this seed populates the profile.

insert into profiles (
  id,
  display_name,
  email,
  role,
  location,
  location_city,
  location_state,
  location_zip
) values (
  '00000000-0000-0000-0000-000000000001',
  'Geoff',
  'clearframedigital@gmail.com',
  'seller',
  extensions.st_setsrid(extensions.st_makepoint(-96.7970, 32.7767), 4326)::extensions.geography, -- Dallas, TX
  'Dallas',
  'TX',
  '75201'
) on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  role = excluded.role,
  location = excluded.location,
  location_city = excluded.location_city,
  location_state = excluded.location_state,
  location_zip = excluded.location_zip;
