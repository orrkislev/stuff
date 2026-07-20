# Stuff Catalog — Kislev Family Moving Sale 📦

A visual catalog of household items being sold, given away, or moved as the Kislev family relocates from Israel to the Netherlands.

## What This Is

This is a static website that displays all our stuff in a grid-based catalog. Each item has:
- A **real photo** (cleaned up via AI if the original was messy)
- A **silhouette thumbnail** (generated via Grok Imagine, traced shape in a flat color on beige background)
- **Status**: available, reserved, or gone
- **Price** (if set), **recipient** (if reserved/gone), **description**

The site is designed to be shared with friends/family so they can browse what's available and claim things.

## How It Works

- `index.html` — the main catalog page (grid-based, responsive, mobile + desktop)
- `lists.html` — alternative list view
- `data/items.json` — all item data (id, title, category, status, images, etc.)
- `images/` — real photos (`*-real.jpg`) and silhouette thumbnails (`*-silhouette.jpg`)
- `ADDING-ITEMS.md` — the workflow for adding new items (photo cleanup → silhouette → JSON entry)
- `scripts/silhouette.py` — fallback Python script for generating silhouettes if Grok is unavailable

## Categories

| ID | Name (Hebrew) |
|---|---|
| livingroom | סלון |
| kitchen | מטבח |
| bedroom | חדר שינה |
| kids | חדר ילדים |
| books | ספרים |
| electronics | אלקטרוניקה |
| garden | גינה ומרפסת |
| garden2 | גינה 2 (overflow on mobile) |
| furniture | ריהוט |
| tools | כלים וציוד |
| decor | עיצוב ונוי |
| other | שונות |

## Statuses

- **available** — for sale, looking for a buyer
- **reserved** — someone claimed it, pending pickup
- **gone** — picked up / delivered

## Adding Items

See `ADDING-ITEMS.md` for the full workflow. Summary:
1. Receive a photo (via Telegram)
2. Clean it up if messy (Gemini/Nano Banana 2 image editing)
3. Ask for extra details if useful (dimensions, brand, condition)
4. Generate silhouette thumbnail (Grok Imagine `/v1/images/edits`)
5. Add entry to `data/items.json`

## Deployment

This is a static site deployed via **GitHub Pages**. Push to `main` and it updates automatically.

## Context

The Kislev family (Orr, Smadar, Geva, Emek) is moving from Rosh HaAyin, Israel to Utrecht, Netherlands in August 2026. This catalog helps them sell, give away, and track all their belongings before the move.

---

Built with help from Loosh 🐱 (OpenClaw assistant)
