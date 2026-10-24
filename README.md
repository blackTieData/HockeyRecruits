# Hockey Recruits

A web app that shows the hockey recruiting Google Sheet as a searchable, sortable table with charts.
Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui.

## Usage

The sheet link is hardcoded as `SHEET_URL` in `src/lib/sheet.ts`; edit it to point at a different sheet.
The sheet must be shared as **Anyone with the link → Viewer**.

- The sheet's per-school blocks (with DECOMMITS / TRACKING sections) are flattened into one table with
  School, Conference and Status columns, plus dropdown filters for each.
- The sheet is read as an `.xlsx` export (not CSV) so its color key survives. Colors become a
  Verification column (fill on the player's name), a Team Note column (text color on the current team)
  and a Commitment column (yellow class cell). Icons next to the player and current team show them;
  hover or tap an icon for its meaning, or open **Key** for the full legend. Mappings live in `src/lib/key.ts`.
- School and current-team logos show before the name. They're stored locally in `public/logos/`, with the
  name-to-file mapping in `src/lib/logos.json`; teams without a logo fall back to their league's logo, or none.
- Columns are sized to fit their content; the rare longer value is cut off with "…" (hover to see it all).
- Click a column header to sort (click again to reverse).
- Click a row to highlight it; click it again to clear. **Clear highlighted** removes them all.
- **Columns** shows or hides columns; your choice is remembered in this browser.
- The **Charts** tab follows the search and filters. Without a Status filter, charts count committed
  players only, so recent-commit and tracking rows aren't double counted.
- The **Light / Dark** button switches theme (dark by default); your choice is remembered in this browser.

## Running locally

```sh
npm install
npm run dev
```

then open http://localhost:5173.

## Updating logos

```sh
python3 scripts/fetch-logos.py
```

re-downloads every logo (needs Python 3 with Pillow and `curl`). NCAA logos come from ESPN; junior logos
come from each league's site, using the team lists at the top of the script, which need updating when a
league adds, moves or renames a team.

## Deploying

```sh
npm run build
```

writes a static site to `dist/`, which can be hosted on GitHub Pages, Netlify, Cloudflare Pages, etc.
