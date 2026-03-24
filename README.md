# STMS Mountain Bike Team Website

A modern, **mobile-first** website for the **Sonoran Trails Middle School Mountain Bike Team** competing in the [Arizona Cycling Association (ACA)](https://arizonacycling.org/).

## Pages

| File | Description |
|---|---|
| `index.html` | Home page — hero, announcements, quick links, practice schedule |
| `schedule.html` | 2025 race schedule with dates, locations, maps, and gear requirements |
| `register.html` | Rider registration form with parent/guardian and emergency contact info |
| `volunteers.html` | Volunteer opportunities and sign-up form |
| `apparel.html` | Team apparel order form with rider-by-rider sizing and quantity |
| `sponsors.html` | Sponsor recognition and sponsorship tier information |

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
STMSMountainBikeTream/
├── index.html          # Home
├── schedule.html       # Race Schedule
├── register.html       # Rider Registration
├── apparel.html        # Team Apparel Orders
├── volunteers.html     # Volunteer Sign-Up
├── sponsors.html       # Sponsors
├── functions/
│   └── submit-apparel.js # Netlify function -> Supabase insert
├── css/
│   └── styles.css      # Mobile-first stylesheet
└── js/
    └── main.js         # Navigation, forms, animations
```

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

Required Netlify environment variables:

- `ADMIN_REPORT_PASSCODE` = shared admin passcode used on the login page
- `ADMIN_REPORT_TOKEN_SECRET` = long random secret used to sign short-lived admin session tokens

Admin pages:

- `admin-login.html` = passcode sign-in page
- `admin-orders.html` = protected apparel order report

Security model:

- The browser never receives the Supabase service-role key.
- Login issues a short-lived signed token.
- The report function verifies that token before querying Supabase.
- Logging out clears the client session token.

## Links

- [STMS School Website](https://stms.ccusd93.org/)
- [Arizona Cycling Association (ACA)](https://arizonacycling.org/)
- [CCUSD 93 District](https://www.ccusd93.org/)
