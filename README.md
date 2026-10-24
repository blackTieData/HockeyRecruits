# Hockey Recruits

A web app that shows the hockey recruiting Google Sheet as a searchable, sortable table with charts.
Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui.

## Usage

The sheet link is hardcoded as `SHEET_URL` in `src/lib/sheet.ts`; edit it to point at a different sheet.
The sheet must be shared as **Anyone with the link → Viewer**.

- The sheet's per-school blocks (with DECOMMITS / TRACKING sections) are flattened into one table with
  School, Conference and Status columns, plus dropdown filters for each.
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

## Deploying

```sh
npm run build
```

writes a static site to `dist/`, which can be hosted on GitHub Pages, Netlify, Cloudflare Pages, etc.
