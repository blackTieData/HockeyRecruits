// Loads the public recruiting Google Sheet as CSV and flattens it into one table.

export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RA5NLrXPTVyOmAh5Db0QWQse7deG5IQS9JOYSCZzeiU/edit?usp=sharing"

export type Row = { id: number; cells: string[] }
export type Sheet = { headers: string[]; rows: Row[] }

// Turn a Google Sheets share/edit link into a CSV URL that allows cross-origin reads.
export function toCsvUrl(link: string) {
  const url = new URL(link)
  // Accepts /spreadsheets/d/<id>/... and account-scoped /spreadsheets/u/0/d/<id>/... links.
  const idMatch = url.pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error("That doesn't look like a Google Sheets link.")
  // rtpof=true marks an uploaded Office file opened in Sheets; Google only exports native Sheets as CSV.
  if (url.searchParams.get("rtpof") === "true") {
    throw new Error("This link is an Excel file stored in Google Drive, not a Google Sheet. " +
      "Open it, choose File → Save as Google Sheets, share the new sheet publicly, and use its link.")
  }
  const gid = url.searchParams.get("gid") || (url.hash.match(/gid=(\d+)/) || [])[1]
  const csv = new URL(`https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq`)
  csv.searchParams.set("tqx", "out:csv")
  if (gid) csv.searchParams.set("gid", gid)
  return csv.toString()
}

// RFC 4180 CSV parser: handles quoted fields, escaped quotes, and newlines inside quotes.
export function parseCsv(text: string) {
  const out: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); out.push(row); row = []; field = ""
    } else field += c
  }
  if (field || row.length) { row.push(field); out.push(row) }
  return out
}

const PLAYER_COLS = ["Class", "Player", "Position", "Current Team", "Date Committed",
  "Nationality", "Birthdate", "Draft Year", "Prev Commit", "Where Going"]
// Lead with who and where, so the most-used columns are visible without scrolling right.
const LEAD_COLS = ["Player", "School", "Status", "Class", "Position", "Conference"]

// The recruiting sheet is one block per school: a school row (name, handle, conference),
// a column-header row, committed players, then DECOMMITS and TRACKING sub-sections.
// Rows above the first school are a "recent commits" feed with "class - school" in column A.
// Returns a flat table with School/Conference/Status columns, or null if the layout isn't recognised.
function flattenSchoolBlocks(data: string[][]) {
  const isPlayerHeader = (r: string[]) => /^(class|date)$/i.test(r[0]) && /^player name$/i.test(r[1])
  const isSchoolRow = (r: string[]) => r[0] && r[1] && !/^\d/.test(r[0]) && r.slice(3).every(c => !c)
  if (!data.some(isPlayerHeader)) return null

  const out: string[][] = []
  let school = "", conference = "", status = "Recent commit"
  for (const r of data.slice(1)) { // row 0 is Google's guessed header (it swallows the sheet's color key)
    const label = r[0].toUpperCase()
    if (isPlayerHeader(r)) continue
    if (label === "DECOMMITS" && !r[1]) { status = "Decommit"; continue }
    if (label === "TRACKING" && !r[1]) { status = "Tracking"; continue }
    if (isSchoolRow(r)) { school = r[0]; conference = r[2]; status = "Committed"; continue }
    if (!r[1]) continue

    const p = r.slice(0, PLAYER_COLS.length)
    while (p.length < PLAYER_COLS.length) p.push("")
    if (status === "Recent commit") {
      const [cls, ...name] = p[0].split(" - ")
      school = name.join(" - ")
      p[0] = cls
    } else if (status === "Tracking") {
      p[4] = p[0] // tracking rows carry the date added instead of a class
      p[0] = ""
    }
    out.push([...p, school, conference, status])
  }
  // Recent-commit rows only say "Union"; resolve to the full name ("Union Dutchmen") and its conference.
  const blocks = [...new Map(out.filter(r => r[11]).map(r => [r[10], r[11]]))]
  for (const r of out.filter(r => !r[11])) {
    const match = blocks.find(([name]) => name.toLowerCase().startsWith(r[10].toLowerCase() + " "))
    if (match) [r[10], r[11]] = match
  }
  const all = [...PLAYER_COLS, "School", "Conference", "Status"]
  const order = [...LEAD_COLS, ...all.filter(h => !LEAD_COLS.includes(h))]
  const idx = order.map(h => all.indexOf(h))
  return { headers: order, rows: out.map(r => idx.map(i => r[i])) }
}

export async function loadSheet(link = SHEET_URL): Promise<Sheet> {
  const res = await fetch(toCsvUrl(link))
  if (!res.ok) throw new Error(`Google returned ${res.status}. Is the sheet shared publicly?`)
  const text = await res.text()
  if (text.trimStart().startsWith("<")) {
    throw new Error("Couldn't read the sheet. Make sure it's shared as “Anyone with the link can view”.")
  }
  const data = parseCsv(text).map(r => r.map(c => c.trim())).filter(r => r.some(Boolean))
  if (!data.length) throw new Error("The sheet is empty.")
  const { headers, rows } = flattenSchoolBlocks(data) || { headers: data[0], rows: data.slice(1) }
  return { headers, rows: rows.map((cells, id) => ({ id, cells })) }
}

// m/d/yy or m/d/yyyy -> timestamp, so dates sort chronologically rather than as text.
function parseDate(s: string) {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  return Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2])
}

export function compare(a: string, b: string) {
  const da = parseDate(a), db = parseDate(b)
  if (da !== null && db !== null) return da - db
  const na = parseFloat(a.replace(/[$,%]/g, ""))
  const nb = parseFloat(b.replace(/[$,%]/g, ""))
  if (!isNaN(na) && !isNaN(nb) && /^[\s$\d.,%-]+$/.test(a) && /^[\s$\d.,%-]+$/.test(b)) return na - nb
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}
