# Hockey Recruits

A simple static web app for viewing the contents of a public Google Sheet as a searchable, sortable table.

## Usage

1. In Google Sheets, click **Share** and set General access to **Anyone with the link → Viewer**.
2. Open `index.html` and paste the sheet's link, then click **Load**.

- The first row of the sheet is used as column headers.
- Click a column header to sort (click again to reverse).
- Type in the filter box to show only rows containing that text.
- To show a specific tab, use a link that includes `#gid=...` (copy the URL while that tab is open).
- The loaded sheet is saved in the page URL (`?sheet=...`), so you can bookmark or share the view.

## Running locally

No build step or dependencies. Serve the folder with any static server, e.g.:

```sh
python3 -m http.server 8000
```

then open http://localhost:8000.

It can also be hosted as-is on GitHub Pages, Netlify, Cloudflare Pages, etc.
