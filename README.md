# STMS Mountain Bike Team Website

A modern, **mobile-first** website for the **Sonoran Trails Middle School Mountain Bike Team** competing in the [Arizona Cycling Association (ACA)](https://arizonacycling.org/).

## Pages

| File | Description |
|---|---|
| `index.html` | Home page — hero, announcements, quick links, practice schedule |
| `schedule.html` | 2026 race schedule with dates, locations, maps, and gear requirements |
| `register.html` | Rider registration form with parent/guardian and emergency contact info |
| `volunteers.html` | Volunteer opportunities and sign-up form |
| `apparel.html` | Team apparel order form with rider-by-rider sizing and quantity |
| `sponsors.html` | Sponsor recognition and sponsorship tier information |
| `cactus-shadows.html` | Cactus Shadows High School MTB team page with CSMTB branding |
| `quickstart.html` | Quick-reference onboarding page |
| `admin-login.html` | Admin passcode sign-in page |
| `admin-orders.html` | Protected apparel order report |

## Tech Stack

- **Pure HTML5 / CSS3 / Vanilla JavaScript** frontend — no frameworks
- **Netlify Functions** for server-side form processing
- **Supabase** table storage for apparel orders
- **Mobile-first responsive design** — optimized for phones at races and practices
- Fast load times with no external network requests
- Accessible markup (ARIA labels, semantic HTML, keyboard navigation)
- CSS custom properties for easy theming

## Project Structure

```
STMSMountainBikeTeam/
├── index.html              # Home
├── schedule.html           # Race Schedule
├── register.html           # Rider Registration
├── apparel.html            # Team Apparel Orders
├── volunteers.html         # Volunteer Sign-Up
├── sponsors.html           # Sponsors
├── cactus-shadows.html     # Cactus Shadows HS MTB Team
├── quickstart.html         # Quick-Reference Onboarding
├── admin-login.html        # Admin Sign-In
├── admin-orders.html       # Protected Order Report
├── functions/
│   ├── submit-apparel.js   # Netlify function -> Supabase insert
│   ├── admin-auth-utils.js # JWT auth utilities
│   ├── admin-login.js      # Login endpoint (issues signed token)
│   └── admin-orders.js     # Protected orders endpoint
├── raceresults/            # Race result PDFs
├── images/                 # Logo assets (STMS + CS logos in JPG/WEBP/SVG)
├── css/
│   └── styles.css          # Mobile-first stylesheet
└── js/
    └── main.js             # Navigation, forms, animations
```

## Race Results

PDF race result documents are stored in the `/raceresults/` directory and linked directly from the site. Add new PDFs there to make them available to riders and families.

## Running Locally

Open `index.html` in any modern web browser. No build step required.

```bash
# If you have Python installed:
python3 -m http.server 8080
# Then visit http://localhost:8080
```

## Supabase Setup (Apparel Orders)

Apparel form submissions are sent to `/.netlify/functions/submit-apparel` and written to Supabase.

Create a table in Supabase:

```sql
create table if not exists public.apparel_orders (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    contact_email text not null,
    contact_name text not null,
    rider_count integer not null,
    source text not null default 'apparel-form',
    order_payload jsonb not null
);
```

Required Netlify environment variables:

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your service role key (server-side only)
- `SUPABASE_APPAREL_TABLE` = optional table override (defaults to `apparel_orders`)

Suggested security settings in Supabase:

```sql
alter table public.apparel_orders enable row level security;

create policy "No direct client writes"
on public.apparel_orders
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
```

## Verify Apparel Submission

1. Open the apparel page and complete at least one rider.
2. Click `Review Order`, then `Confirm & Submit`.
3. Confirm the success message appears.
4. Verify one new row exists in `public.apparel_orders` with full `order_payload` JSON.

## Admin Apparel Report Setup

The admin report uses two Netlify Functions:

- `/.netlify/functions/admin-login`
- `/.netlify/functions/admin-orders`
- `/.netlify/functions/admin-apparel-store-status` (admin ON/OFF toggle)
- `/.netlify/functions/apparel-store-status` (public read-only store state)

Required Netlify environment variables:

- `ADMIN_REPORT_PASSCODE` = shared admin passcode used on the login page
- `ADMIN_REPORT_TOKEN_SECRET` = long random secret used to sign short-lived admin session tokens
- `SUPABASE_SETTINGS_TABLE` = optional settings table override (defaults to `app_settings`)
- `APPAREL_ORDERS_DEFAULT_OPEN` = optional fallback (`true` by default) used if settings row is missing

Create the settings table in Supabase so admins can open/close the public apparel store:

```sql
create table if not exists public.app_settings (
    setting_key text primary key,
    setting_value jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text
);

insert into public.app_settings (setting_key, setting_value)
values ('apparel_orders_open', '{"isOpen": true}'::jsonb)
on conflict (setting_key) do nothing;
```

Operational behavior:

- Toggle is controlled in `admin-orders.html` and persists immediately in Supabase.
- When public store is OFF, `submit-apparel` rejects public submissions with HTTP `403`.
- Admin manual entries from `admin-orders.html` remain allowed while public store is OFF.

Admin pages:

- `admin-login.html` = passcode sign-in page
- `admin-orders.html` = protected apparel order report

Security model:

- The browser never receives the Supabase service-role key.
- Login issues a short-lived signed token that expires after 30 minutes.
- The report function verifies that token before querying Supabase.
- Logging out clears the client session token.

## Links

- [STMS School Website](https://stms.ccusd93.org/)
- [Arizona Cycling Association (ACA)](https://arizonacycling.org/)
- [CCUSD 93 District](https://www.ccusd93.org/)
