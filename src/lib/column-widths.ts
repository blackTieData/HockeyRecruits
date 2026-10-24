// Fit each table column to most of its content, so a few long values (player notes, odd class
// entries) don't stretch a whole column. The rare longer cells are cut off with an ellipsis instead.

import type { Row } from "@/lib/sheet"

const CELL_PADDING = 16 // shadcn TableCell/TableHead: px-2 on each side
const SORT_ICON = 18 // arrow + gap, reserved so sorting doesn't shift the layout
export const ICON_WIDTH = 22 // a 16px key icon plus its gap and focus ring
export const LOGO_WIDTH = 26 // a 20px logo plus its gap
const MAX_WIDTH = 320
const PERCENTILE = 0.98
// If the longest value is within this factor of the typical one, fit the longest (e.g. "Recent commit").
const FIT_ALL_RATIO = 1.5

// Extra width beyond the text: logos before school/team names, key icons after player/team names.
export type Extras = (header: string, row: Row) => number

// Player names sometimes carry a note ("Maxime Lafond (NOTE: ...)"); the Player column fits its
// longest name without the note, so every name shows in full and only the notes get cut off.
const measured = (header: string, value: string) =>
  header === "Player" ? value.replace(/\s*\(.*$/, "") : value

export function columnWidths(headers: string[], rows: Row[], extras: Extras): number[] {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return headers.map(() => 0)
  const font = getComputedStyle(document.body).fontFamily

  return headers.map((header, col) => {
    ctx.font = `500 14px ${font}`
    const headerWidth = ctx.measureText(header).width + SORT_ICON
    ctx.font = `${header === "Player" ? 500 : 400} 14px ${font}`
    const widths = rows
      .map(r => (r.cells[col] ? ctx.measureText(measured(header, r.cells[col])).width : 0) + extras(header, r))
      .sort((a, b) => a - b)
    const typical = widths[Math.floor((widths.length - 1) * PERCENTILE)] ?? 0
    const longest = widths.at(-1) ?? 0
    const content = header === "Player" || longest <= typical * FIT_ALL_RATIO ? longest : typical
    return Math.ceil(Math.min(MAX_WIDTH, Math.max(headerWidth, content)) + CELL_PADDING + 4)
  })
}
