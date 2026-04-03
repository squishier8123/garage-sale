---
project: garage-sale
description: AI-powered virtual garage sale marketplace — photo upload, Claude vision pricing, Stripe escrow, hyper-local pickup
product: Garage Sale
---

# Garage Sale

AI-powered virtual garage sale web app. Snap photo, AI identifies + prices, listing goes live, buyer pays via Stripe, pickup coordinated through platform.

## Commands

- `npm run dev` — Start Next.js dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run test` — Vitest unit/integration tests
- `npm run test:e2e` — Playwright E2E tests
- `supabase start` — Start local Supabase (Postgres, Auth, Realtime)
- `supabase stop` — Stop local Supabase
- `supabase db reset` — Drop + recreate all tables from migrations
- `supabase db push` — Push migrations to remote Supabase
- `supabase migration new <name>` — Create new migration file

## Architecture

```
src/
  app/
    (storefront)/      # Public pages: browse, search, listing detail
    (seller)/          # Auth-protected: dashboard, listing mgmt, bulk upload
    (auth)/            # Login/signup
    api/
      listings/        # Public listing endpoints + image upload
      bids/            # Guest bid submission
      checkout/        # Stripe checkout session creation
      webhooks/stripe/ # Payment lifecycle webhooks
      seller/          # Auth-protected seller endpoints
      cron/            # Vercel Cron: auction close, expiry, escrow, analytics
      og/              # Dynamic OG image generation
  lib/
    supabase/          # client.ts, server.ts, admin.ts (browser/RSC/service-role)
    ai/                # Claude Haiku vision + pricing services
    comps/             # SearchAPI.io comp search + cache layer
    images/            # Vercel Blob upload, client optimization, PixelAPI bg removal
    services/          # Orchestrators (listing-pipeline.ts)
    utils/             # Shared helpers
  components/
    storefront/        # ListingCard, ListingGrid, SearchBar, LocationBar
    seller/            # Dashboard stats, ListingWizard, BulkUpload, BatchReview
    ui/                # Shared UI primitives
  middleware.ts        # Supabase auth refresh, /seller/* route protection, Arcjet rate limiting
supabase/
  migrations/          # Sequential SQL migrations (001_, 002_, etc.)
  seed.sql             # Dev seed data (Geoff's seller profile)
  config.toml          # Supabase local config
```

## Tech Stack

- **Framework:** Next.js 15 App Router + TypeScript + Tailwind CSS
- **Database:** Supabase (PostgreSQL + PostGIS + pg_trgm + Realtime)
- **Auth:** Supabase Auth + RLS (v1: Geoff only, v2-ready: role column)
- **Payments:** Stripe (personal account v1, Connect Express v2)
- **AI Vision:** Claude Haiku 4.5 structured outputs (`output_format` param)
- **Price Comps:** SearchAPI.io (PRIMARY, $35/mo) + eBay Browse API (FALLBACK)
- **Images:** Vercel Blob (CDN + next/image) + PixelAPI (bg removal)
- **Security:** Arcjet (rate limiting, bot detection, shield WAF)
- **Deploy:** Vercel (preview on push, prod on main)

## Environment

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server-only, NEVER expose)
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` — Stripe secret key (test mode for dev)
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `SEARCHAPI_API_KEY` — SearchAPI.io key
- `PIXELAPI_API_KEY` — PixelAPI background removal key
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob storage token
- `ARCJET_KEY` — Arcjet API key

Global keys live in `~/.claude/.env`. Project keys in `.env.local` (gitignored).

## Code Style

- All prices stored as **integers in cents** — never use floats for money
- Immutable data patterns — return new objects, never mutate
- Server Components by default, `"use client"` only when needed (interactivity, hooks)
- Supabase queries: use `server.ts` client in RSC/route handlers, `client.ts` in client components, `admin.ts` for service-role operations
- Claude API: always use structured outputs (`output_format`) — no raw text parsing
- Error handling: explicit at every level, user-friendly messages in UI, detailed logs server-side
- File size: 200-400 lines typical, 800 max — extract when larger

## Key Conventions

- **RLS enforced on all tables** — never bypass with service role unless explicitly needed (webhooks, cron)
- **Guest buyers:** JWT token in confirmation email for post-purchase messaging/pickup — no account required
- **Comp caching:** 7-day fresh, 30-day stale-serve, normalized cache keys (lowercase, sorted words)
- **Auction safety:** Postgres RPC with `SELECT FOR UPDATE` for bid race conditions, 2-min anti-sniping extension
- **Escrow:** Capture immediately on payment (not delayed auth), track 30-day window in app, refund if no pickup
- **Listing expiry:** 30 days from publish, renewable. Skip expiration if active auction with bids
- **$5 minimum** listing price enforced — sub-$5 items get bundle suggestion
- **3.5% platform fee** shown transparently before publish
- **Seller address hidden** until payment confirmed

## Data Model

11 tables: profiles, listings, listing_images, bids, transactions, pickup_time_slots, messages, bundles, ebay_comps, comp_cache, listing_views, seller_analytics_daily

PostgreSQL extensions: `postgis`, `uuid-ossp`, `pg_trgm`

Full schema in build plan: `~/.claude/plans/shiny-wiggling-quasar.md`

## AI Pipeline Flow

```
Upload photos → Vercel Blob (client presigned URL)
  → Validate (type, size, count: 1-8)
  → Primary image → Claude Haiku 4.5 (structured output: category, brand, model, condition, confidence)
  → confidence < 0.7 → flag fields for seller review
  → search_query → comp_cache check → SearchAPI.io if miss → cache result
  → Item + comps → Claude Haiku 4.5 (pricing: suggested_price, range, description, velocity)
  → Primary image → PixelAPI bg removal (parallel with pricing)
  → Assemble draft listing for seller review
```

Fallbacks: Claude down → manual entry | SearchAPI down → stale cache → eBay Browse API → manual | PixelAPI down → original photo

## Gotchas

- eBay Finding API (`findCompletedItems`) was **decommissioned Feb 2025** — do NOT attempt to use it. SearchAPI.io is the primary comp source
- Supabase free tier **pauses after 1 week inactivity** — needs cron ping or paid plan
- Stripe manual capture auth holds expire in **7 days** (not 30) — that's why we capture immediately
- Vercel serverless has **4.5MB request body limit** — images must use client-side upload to Vercel Blob
- PostGIS `geography` type uses **meters** internally — convert miles to meters in queries (1 mile = 1609.34m)
- Claude structured outputs require schema defined upfront — less flexible but guaranteed valid JSON
- SearchAPI.io `engine: "ebay_search"` with sold filter — grey-zone vs eBay ToS, but industry standard

## Testing

- **Unit/Integration:** Vitest — test AI service mocks, pricing logic, cache behavior, fee calculations
- **E2E:** Playwright — critical flows: listing creation, browse, bid, checkout, pickup
- **DB tests:** Run against local Supabase (`supabase start`), reset between suites
- **Target:** 80%+ coverage

## Build Plan

Full plan with TRD, spec, ADRs, data model, and task list: `~/.claude/plans/shiny-wiggling-quasar.md`

8 phases: Foundation → AI Pipeline → [Storefront || Dashboard] → Auctions → Payments → Pickup → Polish