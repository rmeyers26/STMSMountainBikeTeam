# STMS Mountain Bike Team Website

A modern, **mobile-first** website for the **Sonoran Trails Middle School Mountain Bike Team** competing in the [Arizona Interscholastic Cycling League (AICL)](https://arizonacycling.org/).

## Pages

| File | Description |
|---|---|
| `index.html` | Home page — hero, announcements, quick links, practice schedule |
| `schedule.html` | 2025 race schedule with dates, locations, maps, and gear requirements |
| `register.html` | Rider registration form with parent/guardian and emergency contact info |
| `volunteers.html` | Volunteer opportunities and sign-up form |
| `sponsors.html` | Sponsor recognition and sponsorship tier information |

## Tech Stack

- **Pure HTML5 / CSS3 / Vanilla JavaScript** — no frameworks, no dependencies
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
├── volunteers.html     # Volunteer Sign-Up
├── sponsors.html       # Sponsors
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

## Links

- [STMS School Website](https://stms.ccusd93.org/)
- [Arizona Interscholastic Cycling League](https://arizonacycling.org/)
- [CCUSD 93 District](https://www.ccusd93.org/)
