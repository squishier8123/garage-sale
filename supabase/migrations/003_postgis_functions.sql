-- 003_postgis_functions.sql
-- PostGIS RPC functions for location-based queries

-- Set search_path to include extensions schema for PostGIS types/functions
set search_path to public, extensions;

-- =============================================================================
-- nearby_listings: search active listings within radius
-- =============================================================================
create or replace function nearby_listings(
  lat double precision,
  lng double precision,
  radius_miles integer default 25,
  search_query text default null,
  category_filter text default null,
  condition_filter listing_condition default null,
  price_min integer default null,
  price_max integer default null,
  strategy_filter price_strategy default null,
  sort_by text default 'distance',
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  condition listing_condition,
  price_strategy price_strategy,
  buy_now_price integer,
  current_bid integer,
  bid_count integer,
  ai_confidence numeric,
  status listing_status,
  location_city text,
  location_state char(2),
  published_at timestamptz,
  auction_ends_at timestamptz,
  seller_id uuid,
  seller_display_name text,
  hero_image_url text,
  distance_miles double precision
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  radius_meters double precision := radius_miles * 1609.34;
  search_point geography := st_setsrid(st_makepoint(lng, lat), 4326)::geography;
begin
  return query
  select
    l.id,
    l.title,
    l.description,
    l.category,
    l.condition,
    l.price_strategy,
    l.buy_now_price,
    l.current_bid,
    l.bid_count,
    l.ai_confidence,
    l.status,
    l.location_city,
    l.location_state,
    l.published_at,
    l.auction_ends_at,
    l.seller_id,
    p.display_name as seller_display_name,
    li.url as hero_image_url,
    round((st_distance(l.location, search_point) / 1609.34)::numeric, 1)::double precision as distance_miles
  from listings l
  join profiles p on p.id = l.seller_id
  left join listing_images li on li.listing_id = l.id and li.position = 0
  where l.status = 'active'
    and l.location is not null
    and st_dwithin(l.location, search_point, radius_meters)
    and (search_query is null or (
      l.title % search_query or l.description % search_query
    ))
    and (category_filter is null or l.category = category_filter)
    and (condition_filter is null or l.condition = condition_filter)
    and (price_min is null or coalesce(l.buy_now_price, l.current_bid, 0) >= price_min)
    and (price_max is null or coalesce(l.buy_now_price, l.current_bid, 0) <= price_max)
    and (strategy_filter is null or l.price_strategy = strategy_filter)
  order by
    case when sort_by = 'distance' then st_distance(l.location, search_point) end asc,
    case when sort_by = 'newest' then l.published_at end desc,
    case when sort_by = 'price_low' then coalesce(l.buy_now_price, l.current_bid, 0) end asc,
    case when sort_by = 'price_high' then coalesce(l.buy_now_price, l.current_bid, 0) end desc,
    case when sort_by = 'ending_soon' then l.auction_ends_at end asc nulls last
  limit page_limit
  offset page_offset;
end;
$$;

-- =============================================================================
-- count_nearby_listings: count for pagination
-- =============================================================================
create or replace function count_nearby_listings(
  lat double precision,
  lng double precision,
  radius_miles integer default 25,
  search_query text default null,
  category_filter text default null,
  condition_filter listing_condition default null,
  price_min integer default null,
  price_max integer default null,
  strategy_filter price_strategy default null
)
returns integer
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  radius_meters double precision := radius_miles * 1609.34;
  search_point geography := st_setsrid(st_makepoint(lng, lat), 4326)::geography;
  total integer;
begin
  select count(*)::integer into total
  from listings l
  where l.status = 'active'
    and l.location is not null
    and st_dwithin(l.location, search_point, radius_meters)
    and (search_query is null or (
      l.title % search_query or l.description % search_query
    ))
    and (category_filter is null or l.category = category_filter)
    and (condition_filter is null or l.condition = condition_filter)
    and (price_min is null or coalesce(l.buy_now_price, l.current_bid, 0) >= price_min)
    and (price_max is null or coalesce(l.buy_now_price, l.current_bid, 0) <= price_max)
    and (strategy_filter is null or l.price_strategy = strategy_filter);

  return total;
end;
$$;

-- =============================================================================
-- place_bid: atomic bid placement with race condition safety
-- =============================================================================
create or replace function place_bid(
  p_listing_id uuid,
  p_bidder_email text,
  p_bidder_name text,
  p_amount integer,
  p_bidder_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_listing listings%rowtype;
  v_bid_id uuid;
  v_anti_snipe_threshold interval := interval '2 minutes';
begin
  -- Lock the listing row to prevent race conditions
  select * into v_listing
  from listings
  where id = p_listing_id
  for update;

  -- Validate listing exists
  if not found then
    return jsonb_build_object('error', 'Listing not found');
  end if;

  -- Validate listing is active and accepts bids
  if v_listing.status != 'active' then
    return jsonb_build_object('error', 'Listing is not active');
  end if;

  if v_listing.price_strategy = 'buy_now' then
    return jsonb_build_object('error', 'This listing does not accept bids');
  end if;

  -- Validate auction hasn't expired
  if v_listing.auction_ends_at is not null and v_listing.auction_ends_at < now() then
    return jsonb_build_object('error', 'Auction has ended');
  end if;

  -- Validate bid amount
  if p_amount < 500 then
    return jsonb_build_object('error', 'Minimum bid is $5.00');
  end if;

  if v_listing.current_bid is not null and p_amount <= v_listing.current_bid then
    return jsonb_build_object('error', 'Bid must be higher than current bid of $' || (v_listing.current_bid / 100.0)::text);
  end if;

  if v_listing.auction_floor_price is not null and p_amount < v_listing.auction_floor_price then
    return jsonb_build_object('error', 'Bid must meet the floor price of $' || (v_listing.auction_floor_price / 100.0)::text);
  end if;

  -- Mark previous winning bid as not winning
  update bids
  set is_winning = false
  where listing_id = p_listing_id and is_winning = true;

  -- Insert the new bid
  insert into bids (listing_id, bidder_email, bidder_name, amount, is_winning, bidder_id)
  values (p_listing_id, p_bidder_email, p_bidder_name, p_amount, true, p_bidder_id)
  returning id into v_bid_id;

  -- Update listing denormalized fields
  update listings
  set
    current_bid = p_amount,
    bid_count = bid_count + 1,
    buy_now_available = false -- disable buy now once first bid placed
  where id = p_listing_id;

  -- Anti-sniping: extend auction if bid placed in last 2 minutes
  if v_listing.auction_ends_at is not null
     and v_listing.auction_ends_at - now() < v_anti_snipe_threshold then
    update listings
    set auction_ends_at = now() + v_anti_snipe_threshold
    where id = p_listing_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'bid_id', v_bid_id,
    'amount', p_amount,
    'bid_count', v_listing.bid_count + 1
  );
end;
$$;
