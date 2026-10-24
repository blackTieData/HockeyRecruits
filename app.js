// Loads a public Google Sheet as CSV and renders it as a filterable, sortable table.

const form = document.getElementById("sheet-form");
const urlInput = document.getElementById("sheet-url");
const searchInput = document.getElementById("search");
const toolbar = document.getElementById("toolbar");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");
const tableWrap = document.getElementById("table-wrap");

let headers = [];
let rows = [];
let sortCol = -1;
let sortDir = 1;

// Turn a Google Sheets share/edit link into a CSV URL that allows cross-origin reads.
function toCsvUrl(link) {
  const url = new URL(link);
  // Accepts /spreadsheets/d/<id>/... and account-scoped /spreadsheets/u/0/d/<id>/... links.
  const idMatch = url.pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) throw new Error("That doesn't look like a Google Sheets link.");
  // rtpof=true marks an uploaded Office file opened in Sheets; Google only exports native Sheets as CSV.
  if (url.searchParams.get("rtpof") === "true") {
    throw new Error("This link is an Excel file stored in Google Drive, not a Google Sheet. " +
      "Open it, choose File → Save as Google Sheets, share the new sheet publicly, and use its link.");
  }
  const gid = url.searchParams.get("gid") || (url.hash.match(/gid=(\d+)/) || [])[1];
  const csv = new URL(`https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq`);
  csv.searchParams.set("tqx", "out:csv");
  if (gid) csv.searchParams.set("gid", gid);
  return csv.toString();
}

// RFC 4180 CSV parser: handles quoted fields, escaped quotes, and newlines inside quotes.
function parseCsv(text) {
  const out = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); out.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
  statusEl.hidden = !msg;
}

async function load(link) {
  setStatus("Loading…");
  tableWrap.replaceChildren();
  toolbar.hidden = true;
  try {
    const res = await fetch(toCsvUrl(link));
    if (!res.ok) throw new Error(`Google returned ${res.status}. Is the sheet shared publicly?`);
    const text = await res.text();
    if (text.trimStart().startsWith("<")) {
      throw new Error("Couldn't read the sheet. Make sure it's shared as “Anyone with the link can view”.");
    }
    const data = parseCsv(text).map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
    if (!data.length) throw new Error("The sheet is empty.");
    ({ headers, rows } = flattenSchoolBlocks(data) || { headers: data[0], rows: data.slice(1) });
    sortCol = -1;
    searchInput.value = "";
    buildFilters();
    toolbar.hidden = false;
    setStatus("");
    render();
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

const PLAYER_COLS = ["Class", "Player", "Position", "Current Team", "Date Committed",
  "Nationality", "Birthdate", "Draft Year", "Prev Commit", "Where Going"];
const FILTER_COLS = ["Status", "Conference", "School", "Class", "Position"];

// The recruiting sheet is one block per school: a school row (name, handle, conference),
// a column-header row, committed players, then DECOMMITS and TRACKING sub-sections.
// Rows above the first school are a "recent commits" feed with "class - school" in column A.
// Returns a flat table with School/Conference/Status columns, or null if the layout isn't recognised.
function flattenSchoolBlocks(data) {
  const isPlayerHeader = r => /^(class|date)$/i.test(r[0]) && /^player name$/i.test(r[1]);
  const isSchoolRow = r => r[0] && r[1] && !/^\d/.test(r[0]) && r.slice(3).every(c => !c);
  if (!data.some(isPlayerHeader)) return null;

  const out = [];
  let school = "", conference = "", status = "Recent commit";
  for (const r of data.slice(1)) { // row 0 is Google's guessed header (it swallows the sheet's color key)
    const label = r[0].toUpperCase();
    if (isPlayerHeader(r)) continue;
    if (label === "DECOMMITS" && !r[1]) { status = "Decommit"; continue; }
    if (label === "TRACKING" && !r[1]) { status = "Tracking"; continue; }
    if (isSchoolRow(r)) { school = r[0]; conference = r[2]; status = "Committed"; continue; }
    if (!r[1]) continue;

    const p = r.slice(0, PLAYER_COLS.length);
    if (status === "Recent commit") {
      const [cls, ...name] = p[0].split(" - ");
      school = name.join(" - ");
      p[0] = cls;
    } else if (status === "Tracking") {
      p[4] = p[0]; // tracking rows carry the date added instead of a class
      p[0] = "";
    }
    out.push([...p, school, conference, status]);
  }
  // Recent-commit rows only say "Union"; resolve to the full name ("Union Dutchmen") and its conference.
  const blocks = [...new Map(out.filter(r => r[11]).map(r => [r[10], r[11]]))];
  for (const r of out.filter(r => !r[11])) {
    const match = blocks.find(([name]) => name.toLowerCase().startsWith(r[10].toLowerCase() + " "));
    if (match) [r[10], r[11]] = match;
  }
  // Lead with who and where, so the most-used columns are visible without scrolling right.
  const all = [...PLAYER_COLS, "School", "Conference", "Status"];
  const order = ["Player", "School", "Status", "Class", "Position", "Conference",
    ...all.filter(h => !["Player", "School", "Status", "Class", "Position", "Conference"].includes(h))];
  const idx = order.map(h => all.indexOf(h));
  return { headers: order, rows: out.map(r => idx.map(i => r[i])) };
}

// Dropdown filters for any of FILTER_COLS present in the loaded table.
let filters = []; // { col, select }
function buildFilters() {
  document.querySelectorAll("#toolbar select").forEach(s => s.remove());
  filters = FILTER_COLS.map(name => headers.indexOf(name)).filter(col => col >= 0).map(col => {
    const select = document.createElement("select");
    select.setAttribute("aria-label", headers[col]);
    const values = [...new Set(rows.map(r => r[col]).filter(Boolean))].sort(compare);
    select.add(new Option(`All ${headers[col]}`, ""));
    values.forEach(v => select.add(new Option(v, v)));
    select.addEventListener("change", render);
    searchInput.after(select);
    return { col, select };
  });
}

// m/d/yy or m/d/yyyy -> timestamp, so dates sort chronologically rather than as text.
function parseDate(s) {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  return Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], m[1] - 1, m[2]);
}

function compare(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (da !== null && db !== null) return da - db;
  const na = parseFloat(a.replace(/[$,%]/g, ""));
  const nb = parseFloat(b.replace(/[$,%]/g, ""));
  if (!isNaN(na) && !isNaN(nb) && /^[\s$\d.,%-]+$/.test(a) && /^[\s$\d.,%-]+$/.test(b)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function cellContent(value) {
  if (/^https?:\/\/\S+$/.test(value)) {
    const a = document.createElement("a");
    a.href = value;
    a.textContent = value;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }
  return document.createTextNode(value);
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  let view = rows.filter(r =>
    filters.every(({ col, select }) => !select.value || r[col] === select.value) &&
    (!q || r.some(cell => cell.toLowerCase().includes(q))));
  if (sortCol >= 0) view.sort((a, b) => sortDir * compare(a[sortCol] ?? "", b[sortCol] ?? ""));

  const table = document.createElement("table");
  const headRow = table.createTHead().insertRow();
  headers.forEach((h, i) => {
    const th = document.createElement("th");
    th.textContent = h;
    th.scope = "col";
    if (i === sortCol) th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
    th.addEventListener("click", () => {
      sortDir = sortCol === i ? -sortDir : 1;
      sortCol = i;
      render();
    });
    headRow.appendChild(th);
  });

  const body = table.createTBody();
  for (const r of view) {
    const tr = body.insertRow();
    headers.forEach((_, i) => tr.insertCell().appendChild(cellContent(r[i] ?? "")));
  }

  tableWrap.replaceChildren(table);
  countEl.textContent = view.length === rows.length ? `${rows.length} rows` : `${view.length} of ${rows.length} rows`;
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const link = urlInput.value.trim();
  const params = new URLSearchParams(location.search);
  params.set("sheet", link);
  history.replaceState(null, "", `?${params}`);
  load(link);
});

searchInput.addEventListener("input", render);

// Allow sharing a view: ?sheet=<google sheet link>
const initial = new URLSearchParams(location.search).get("sheet");
if (initial) {
  urlInput.value = initial;
  load(initial);
}
