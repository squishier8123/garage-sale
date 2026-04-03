-- 002_rls_policies.sql
-- Row Level Security policies for all tables

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table bids enable row level security;
alter table transactions enable row level security;
alter table pickup_time_slots enable row level security;
alter table messages enable row level security;
alter table bundles enable row level security;
alter table ebay_comps enable row level security;
alter table comp_cache enable row level security;
alter table listing_views enable row level security;
alter table seller_analytics_daily enable row level security;

-- =============================================================================
-- Profiles
-- =============================================================================
-- Anyone can read profiles (display name, avatar for listings)
create policy "profiles_select_public" on profiles
  for select using (true);

-- Users can update their own profile
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- =============================================================================
-- Listings
-- =============================================================================
-- Anyone can read active listings
create policy "listings_select_active" on listings
  for select using (status = 'active');

-- Sellers can read all their own listings (any status)
create policy "listings_select_own" on listings
  for select using (auth.uid() = seller_id);

-- Sellers can insert their own listings
create policy "listings_insert_own" on listings
  for insert with check (auth.uid() = seller_id);

-- Sellers can update their own listings
create policy "listings_update_own" on listings
  for update using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Sellers can delete their own draft listings
create policy "listings_delete_own_draft" on listings
  for delete using (auth.uid() = seller_id and status = 'draft');

-- =============================================================================
-- Listing Images
-- =============================================================================
-- Anyone can view images for active listings
create policy "listing_images_select_active" on listing_images
  for select using (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
      and (listings.status = 'active' or listings.seller_id = auth.uid())
    )
  );

-- Sellers can insert images for their own listings
create policy "listing_images_insert_own" on listing_images
  for insert with check (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Sellers can update images for their own listings
create policy "listing_images_update_own" on listing_images
  for update using (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- Sellers can delete images for their own listings
create policy "listing_images_delete_own" on listing_images
  for delete using (
    exists (
      select 1 from listings
      where listings.id = listing_images.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- =============================================================================
-- Bids
-- =============================================================================
-- Anyone can read bids on active listings (for bid history display)
create policy "bids_select_active" on bids
  for select using (
    exists (
      select 1 from listings
      where listings.id = bids.listing_id
      and (listings.status = 'active' or listings.seller_id = auth.uid())
    )
  );

-- Anyone can place a bid (guest bidding — no auth required)
create policy "bids_insert_guest" on bids
  for insert with check (true);

-- =============================================================================
-- Transactions
-- =============================================================================
-- Sellers can read their own transactions
create policy "transactions_select_seller" on transactions
  for select using (auth.uid() = seller_id);

-- Buyers can read their own transactions (if authenticated)
create policy "transactions_select_buyer" on transactions
  for select using (auth.uid() = buyer_id);

-- Service role handles inserts/updates (webhooks, cron)
-- No insert/update policies for regular users — handled via API routes with service role

-- =============================================================================
-- Pickup Time Slots
-- =============================================================================
-- Sellers can manage their own pickup slots
create policy "pickup_slots_select_seller" on pickup_time_slots
  for select using (auth.uid() = seller_id);

create policy "pickup_slots_insert_seller" on pickup_time_slots
  for insert with check (auth.uid() = seller_id);

create policy "pickup_slots_update_seller" on pickup_time_slots
  for update using (auth.uid() = seller_id);

-- Buyers can view slots for their transactions
create policy "pickup_slots_select_buyer" on pickup_time_slots
  for select using (
    exists (
      select 1 from transactions
      where transactions.id = pickup_time_slots.transaction_id
      and (transactions.buyer_id = auth.uid() or transactions.buyer_email = current_setting('request.jwt.claims', true)::json->>'email')
    )
  );

-- =============================================================================
-- Messages
-- =============================================================================
-- Transaction participants can read messages
create policy "messages_select_participants" on messages
  for select using (
    exists (
      select 1 from transactions
      where transactions.id = messages.transaction_id
      and (transactions.seller_id = auth.uid() or transactions.buyer_id = auth.uid())
    )
  );

-- Transaction participants can insert messages
create policy "messages_insert_participants" on messages
  for insert with check (
    exists (
      select 1 from transactions
      where transactions.id = messages.transaction_id
      and (transactions.seller_id = auth.uid() or transactions.buyer_id = auth.uid())
    )
  );

-- =============================================================================
-- Bundles
-- =============================================================================
-- Anyone can read active bundles
create policy "bundles_select_active" on bundles
  for select using (status = 'active');

-- Sellers can read all their own bundles
create policy "bundles_select_own" on bundles
  for select using (auth.uid() = seller_id);

-- Sellers can insert their own bundles
create policy "bundles_insert_own" on bundles
  for insert with check (auth.uid() = seller_id);

-- Sellers can update their own bundles
create policy "bundles_update_own" on bundles
  for update using (auth.uid() = seller_id);

-- =============================================================================
-- eBay Comps
-- =============================================================================
-- Anyone can read comps for active listings
create policy "ebay_comps_select_active" on ebay_comps
  for select using (
    exists (
      select 1 from listings
      where listings.id = ebay_comps.listing_id
      and (listings.status = 'active' or listings.seller_id = auth.uid())
    )
  );

-- Service role handles inserts (AI pipeline)

-- =============================================================================
-- Comp Cache
-- =============================================================================
-- Service role only — no direct user access to cache table
-- Read access for server-side cache lookups
create policy "comp_cache_select_service" on comp_cache
  for select using (true);

-- =============================================================================
-- Listing Views
-- =============================================================================
-- Anyone can insert views (anonymous tracking)
create policy "listing_views_insert_anon" on listing_views
  for insert with check (true);

-- Sellers can read views for their listings
create policy "listing_views_select_seller" on listing_views
  for select using (
    exists (
      select 1 from listings
      where listings.id = listing_views.listing_id
      and listings.seller_id = auth.uid()
    )
  );

-- =============================================================================
-- Seller Analytics Daily
-- =============================================================================
-- Sellers can read their own analytics
create policy "analytics_select_own" on seller_analytics_daily
  for select using (auth.uid() = seller_id);

-- Service role handles inserts/updates (cron rollup)
