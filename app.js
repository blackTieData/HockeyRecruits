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
    const data = parseCsv(text).filter(r => r.some(cell => cell.trim() !== ""));
    if (!data.length) throw new Error("The sheet is empty.");
    [headers, ...rows] = data;
    sortCol = -1;
    searchInput.value = "";
    toolbar.hidden = false;
    setStatus("");
    render();
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

function compare(a, b) {
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
  let view = q ? rows.filter(r => r.some(cell => cell.toLowerCase().includes(q))) : rows.slice();
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
  countEl.textContent = q ? `${view.length} of ${rows.length} rows` : `${rows.length} rows`;
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
