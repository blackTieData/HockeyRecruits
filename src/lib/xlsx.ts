// Minimal .xlsx reader: cell text plus fill and font colors, which the CSV export drops.

import { strFromU8, unzipSync } from "fflate"

export type Cell = { v: string; fill?: string; font?: string }

const XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

function xml(files: Record<string, Uint8Array>, path: string) {
  const data = files[path]
  return data ? new DOMParser().parseFromString(strFromU8(data), "application/xml") : null
}

const els = (node: Document | Element | null | undefined, tag: string) =>
  node ? [...node.getElementsByTagNameNS(XLSX_NS, tag)] : []

// "FF00FF00" -> "00FF00"; theme/indexed colors are ignored (the sheet's key uses plain RGB).
const rgb = (el: Element | undefined) => el?.getAttribute("rgb")?.slice(-6).toUpperCase()

// Excel serial date -> text in the cell's own format (m/d/yy, m/d/yyyy, m/yyyy).
function formatDate(serial: number, code: string) {
  const d = new Date(Math.round((serial - 25569) * 86400000))
  const y = d.getUTCFullYear()
  return code.toLowerCase()
    .replace(/yyyy/g, String(y))
    .replace(/yy/g, String(y % 100).padStart(2, "0"))
    .replace(/m+/g, String(d.getUTCMonth() + 1))
    .replace(/d+/g, String(d.getUTCDate()))
}

const BUILTIN_DATE_FORMATS: Record<number, string> = { 14: "m/d/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 22: "m/d/yyyy" }

// Reads the first worksheet into a dense grid of rows (row 1 = index 0).
export function readFirstSheet(buffer: ArrayBuffer): Cell[][] {
  const files = unzipSync(new Uint8Array(buffer))

  const workbook = xml(files, "xl/workbook.xml")
  const rels = xml(files, "xl/_rels/workbook.xml.rels")
  const relId = els(workbook, "sheet")[0]?.getAttributeNS(REL_NS, "id")
  const target = [...(rels?.getElementsByTagName("Relationship") ?? [])]
    .find(r => r.getAttribute("Id") === relId)?.getAttribute("Target")
  if (!target) throw new Error("Couldn't find the first sheet in the spreadsheet file.")
  const sheet = xml(files, target.startsWith("/") ? target.slice(1) : `xl/${target}`)

  const strings = els(xml(files, "xl/sharedStrings.xml"), "si")
    .map(si => els(si, "t").map(t => t.textContent ?? "").join(""))

  const styles = xml(files, "xl/styles.xml")
  const fills = els(els(styles, "fills")[0], "fill").map(f => rgb(els(f, "fgColor")[0]))
  const fonts = els(els(styles, "fonts")[0], "font").map(f => rgb(els(f, "color")[0]))
  const numFmts = new Map(els(styles, "numFmt").map(n =>
    [Number(n.getAttribute("numFmtId")), n.getAttribute("formatCode") ?? ""]))
  const xfs = els(els(styles, "cellXfs")[0], "xf").map(xf => {
    const id = Number(xf.getAttribute("numFmtId") ?? 0)
    const code = numFmts.get(id) ?? BUILTIN_DATE_FORMATS[id]
    return {
      fill: fills[Number(xf.getAttribute("fillId") ?? 0)],
      font: fonts[Number(xf.getAttribute("fontId") ?? 0)],
      dateFormat: code && /[dmy]/i.test(code) && !/[#0]/.test(code) ? code : undefined,
    }
  })

  const grid: Cell[][] = []
  for (const row of els(sheet, "row")) {
    const r = Number(row.getAttribute("r")) - 1
    const cells: Cell[] = []
    for (const c of els(row, "c")) {
      const col = [...(c.getAttribute("r") ?? "").replace(/\d+/g, "")]
        .reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const style = xfs[Number(c.getAttribute("s") ?? 0)] ?? {}
      const type = c.getAttribute("t")
      const raw = els(c, "v")[0]?.textContent ?? ""
      let v = raw
      if (type === "s") v = strings[Number(raw)] ?? ""
      else if (type === "inlineStr") v = els(c, "t").map(t => t.textContent ?? "").join("")
      else if (type === "b") v = raw === "1" ? "TRUE" : "FALSE"
      else if (!type || type === "n") {
        if (raw && style.dateFormat) v = formatDate(Number(raw), style.dateFormat)
        else if (raw) v = String(Number(raw))
      }
      cells[col] = { v: v.trim(), fill: style.fill, font: style.font }
    }
    grid[r] = Array.from(cells, c => c ?? { v: "" })
  }
  return Array.from(grid, r => r ?? [])
}
