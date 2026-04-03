-- 001_initial_schema.sql
-- Core schema: extensions, enums, all 11 tables, indexes, triggers

-- =============================================================================
-- Extensions
-- =============================================================================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "postgis" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- =============================================================================
-- Custom Types
-- =============================================================================
create type user_role as enum ('buyer', 'seller', 'driver', 'admin');
create type listing_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type price_strategy as enum ('buy_now', 'auction', 'hybrid');
create type listing_status as enum ('draft', 'active', 'sold', 'expired', 'cancelled', 'relisted');
create type bundle_status as enum ('draft', 'active', 'sold', 'expired', 'cancelled');
create type escrow_status as enum ('pending', 'captured', 'released', 'refunded', 'expired');
create type pickup_status as enum ('pending', 'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled');
create type transaction_status as enum (
  'created', 'payment_pending', 'payment_captured', 'pickup_pending',
  'pickup_scheduled', 'pickup_completed', 'completed', 'cancelled',
  'refunded', 'disputed', 'expired'
);
create type sender_role as enum ('buyer', 'seller', 'system');

-- =============================================================================
-- Profiles
-- =============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  role user_role not null default 'buyer',
  -- Stripe (v2: Connect)
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  -- Driver fields (v2)
  driver_vehicle_type text,
  driver_license_verified boolean not null default false,
  driver_active boolean not null default false,
  -- Location
  location extensions.geography(point, 4326),
  location_city text,
  location_state char(2),
  location_zip text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on profiles(role);
create index idx_profiles_location on profiles using gist(location);

-- =============================================================================
-- Bundles (before listings, since listings reference bundle_id)
-- =============================================================================
create table bundles (
  id uuid primary key default extensions.uuid_generate_v4(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  bundle_price integer not null check (bundle_price >= 500), -- cents, $5 min
  status bundle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bundles_seller on bundles(seller_id);
create index idx_bundles_status on bundles(status);

-- =============================================================================
-- Listings
-- =============================================================================
create table listings (
  id uuid primary key default extensions.uuid_generate_v4(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  condition listing_condition,
  tags text[] not null default '{}',
  -- Pricing
  price_strategy price_strategy not null default 'buy_now',
  buy_now_price integer check (buy_now_price is null or buy_now_price >= 500), -- cents, $5 min
  auction_floor_price integer check (auction_floor_price is null or auction_floor_price >= 500),
  current_bid integer, -- cents, denormalized
  bid_count integer not null default 0,
  buy_now_available boolean not null default true,
  -- AI metadata
  ai_confidence numeric(3,2) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_suggested_price integer,
  ai_category_suggestion text,
  ai_description_draft text,
  ai_needs_review boolean not null default false,
  ai_review_fields text[] not null default '{}',
  -- Comps
  ebay_comp_avg_price integer,
  ebay_comp_count integer,
  ebay_comps_fetched_at timestamptz,
  -- Location
  location extensions.geography(point, 4326),
  location_city text,
  location_state char(2),
  location_zip text,
  pickup_radius_miles integer not null default 25 check (pickup_radius_miles >= 5 and pickup_radius_miles <= 50),
  -- Lifecycle
  status listing_status not null default 'draft',
  published_at timestamptz,
  expires_at timestamptz,
  auction_ends_at timestamptz,
  bundle_id uuid references bundles(id) on delete set null,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_listings_seller on listings(seller_id);
create index idx_listings_status on listings(status);
create index idx_listings_location on listings using gist(location);
create index idx_listings_category on listings(category);
create index idx_listings_published on listings(published_at desc) where status = 'active';
create index idx_listings_auction_ends on listings(auction_ends_at) where auction_ends_at is not null;
create index idx_listings_expires on listings(expires_at) where status = 'active';
create index idx_listings_bundle on listings(bundle_id) where bundle_id is not null;
-- Trigram index for text search
create index idx_listings_title_trgm on listings using gin(title extensions.gin_trgm_ops);
create index idx_listings_description_trgm on listings using gin(description extensions.gin_trgm_ops);

-- =============================================================================
-- Listing Images
-- =============================================================================
create table listing_images (
  id uuid primary key default extensions.uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  url text not null,
  hero_url text, -- bg-removed version
  position integer not null default 0, -- 0 = hero
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

create index idx_listing_images_listing on listing_images(listing_id);
create unique index idx_listing_images_position on listing_images(listing_id, position);

-- =============================================================================
-- Bids
-- =============================================================================
create table bids (
  id uuid primary key default extensions.uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  bidder_email text not null,
  bidder_name text,
  amount integer not null check (amount >= 500), -- cents, $5 min
  is_winning boolean not null default false,
  bidder_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_bids_listing on bids(listing_id);
create index idx_bids_listing_amount on bids(listing_id, amount desc);
create index idx_bids_bidder on bids(bidder_email);

-- =============================================================================
-- Transactions
-- =============================================================================
create table transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete restrict,
  seller_id uuid not null references profiles(id) on delete restrict,
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  buyer_id uuid references profiles(id) on delete set null,
  -- Pricing (all cents)
  item_price integer not null,
  platform_fee integer not null,
  platform_fee_rate numeric(4,3) not null default 0.035,
  total_charged integer not null,
  -- Stripe
  stripe_checkout_session_id text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text, -- v2: Connect
  -- Escrow
  escrow_status escrow_status not null default 'pending',
  captured_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  escrow_expires_at timestamptz,
  -- Pickup
  pickup_status pickup_status not null default 'pending',
  pickup_address text, -- revealed after payment
  pickup_scheduled_at timestamptz,
  pickup_completed_at timestamptz,
  pickup_notes text,
  -- Driver (v2)
  driver_id uuid references profiles(id) on delete set null,
  driver_fee integer,
  -- Lifecycle
  status transaction_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_transactions_listing on transactions(listing_id);
create index idx_transactions_seller on transactions(seller_id);
create index idx_transactions_buyer on transactions(buyer_email);
create index idx_transactions_status on transactions(status);
create index idx_transactions_escrow on transactions(escrow_status) where escrow_status = 'captured';
create index idx_transactions_escrow_expires on transactions(escrow_expires_at) where escrow_status = 'captured';

-- =============================================================================
-- Pickup Time Slots
-- =============================================================================
create table pickup_time_slots (
  id uuid primary key default extensions.uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  constraint valid_time_range check (end_time > start_time)
);

create index idx_pickup_slots_transaction on pickup_time_slots(transaction_id);

-- =============================================================================
-- Messages
-- =============================================================================
create table messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  sender_role sender_role not null,
  sender_id uuid references profiles(id) on delete set null,
  sender_email text,
  body text not null check (char_length(body) <= 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_transaction on messages(transaction_id);
create index idx_messages_created on messages(transaction_id, created_at);

-- =============================================================================
-- eBay Comps
-- =============================================================================
create table ebay_comps (
  id uuid primary key default extensions.uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  ebay_item_id text not null,
  title text not null,
  sold_price integer not null, -- cents
  sold_date timestamptz,
  condition text,
  image_url text,
  listing_url text,
  fetched_at timestamptz not null default now()
);

create index idx_ebay_comps_listing on ebay_comps(listing_id);

-- =============================================================================
-- Comp Cache
-- =============================================================================
create table comp_cache (
  id uuid primary key default extensions.uuid_generate_v4(),
  search_query_normalized text not null unique, -- lowercase, sorted words
  results jsonb not null default '[]',
  result_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null -- fetched_at + 7 days
);

create index idx_comp_cache_query on comp_cache(search_query_normalized);
create index idx_comp_cache_expires on comp_cache(expires_at);

-- =============================================================================
-- Listing Views (analytics)
-- =============================================================================
create table listing_views (
  id uuid primary key default extensions.uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  viewer_ip text,
  viewer_id uuid references profiles(id) on delete set null,
  referrer text,
  created_at timestamptz not null default now()
);

create index idx_listing_views_listing on listing_views(listing_id);
create index idx_listing_views_created on listing_views(created_at);

-- =============================================================================
-- Seller Analytics Daily (rollup)
-- =============================================================================
create table seller_analytics_daily (
  id uuid primary key default extensions.uuid_generate_v4(),
  seller_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  total_views integer not null default 0,
  unique_viewers integer not null default 0,
  total_bids integer not null default 0,
  total_sales integer not null default 0,
  revenue integer not null default 0, -- cents
  fees_paid integer not null default 0, -- cents
  created_at timestamptz not null default now(),
  constraint unique_seller_date unique (seller_id, date)
);

create index idx_analytics_seller_date on seller_analytics_daily(seller_id, date desc);

-- =============================================================================
-- Updated_at trigger function
-- =============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on listings
  for each row execute function update_updated_at();

create trigger set_updated_at before update on bundles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on transactions
  for each row execute function update_updated_at();
