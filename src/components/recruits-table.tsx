import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { KeyIcon } from "@/components/key-icon"
import { TeamLogo } from "@/components/team-logo"
import { columnWidths, ICON_WIDTH, LOGO_WIDTH } from "@/lib/column-widths"
import { schoolLogo, teamLogo } from "@/lib/logos"
import { cn } from "@/lib/utils"
import type { Row } from "@/lib/sheet"

export type Sort = { col: number; dir: 1 | -1 } | null

type Props = {
  headers: string[]
  rows: Row[]
  allRows: Row[] // column widths come from every row, so they don't jump as filters change
  visibleCols: number[]
  sort: Sort
  onSort: (col: number) => void
  highlighted: Set<number>
  onToggleRow: (id: number) => void
}

function CellContent({ value }: { value: string }) {
  if (/^https?:\/\/\S+$/.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener" className="text-primary underline underline-offset-2"
        onClick={e => e.stopPropagation()}>
        {value}
      </a>
    )
  }
  return value
}

// Key icons shown after a cell's text: verification and commitment flags by the player's name,
// the team note by the current team.
const ICON_COLS: Record<string, string[]> = {
  "Player": ["Verification", "Commitment"],
  "Current Team": ["Team Note"],
}

// Logos shown before a cell's text.
const LOGO_COLS: Record<string, (value: string) => ReturnType<typeof schoolLogo>> = {
  "School": schoolLogo,
  "Current Team": teamLogo,
}

export function RecruitsTable({ headers, rows, allRows, visibleCols, sort, onSort, highlighted, onToggleRow }: Props) {
  // Measure text with the real font: re-measure once web fonts have loaded.
  const [fontsReady, setFontsReady] = useState(document.fonts.status === "loaded")
  useEffect(() => { document.fonts.ready.then(() => setFontsReady(true)) }, [])
  const widths = useMemo(() => columnWidths(headers, allRows, (header, row) => {
    const logo = LOGO_COLS[header] && row.cells[headers.indexOf(header)] ? LOGO_WIDTH : 0
    const icons = (ICON_COLS[header] ?? []).filter(h => row.cells[headers.indexOf(h)]).length * ICON_WIDTH
    return logo + icons
  // fontsReady is only a re-measure trigger.
  }), [headers, allRows, fontsReady])

  // Show each new page (or re-sorted/filtered list) from its first row.
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = wrapper.current?.querySelector("[data-slot=table-container]")
    if (container) container.scrollTop = 0
  }, [rows])

  // Mobile: the page scrolls, but the table sits in a sideways-scrolling box, so CSS sticky can't pin
  // its header to the viewport. Instead, shift the header down by however far the table's top has
  // passed under the site's title bar. Desktop keeps the header pinned with sticky inside the box.
  useEffect(() => {
    const desktop = matchMedia("(min-width: 48rem)")
    let frame = 0
    const update = () => {
      frame = 0
      const table = wrapper.current?.querySelector("table")
      const head = table?.tHead
      if (!table || !head) return
      let offset = 0
      if (!desktop.matches) {
        const titleBar = document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 0
        const travel = table.offsetHeight - head.offsetHeight
        offset = Math.min(Math.max(0, titleBar - table.getBoundingClientRect().top), Math.max(0, travel))
      }
      table.style.setProperty("--head-offset", `${offset}px`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", schedule)
    desktop.addEventListener("change", schedule)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener("scroll", schedule)
      removeEventListener("resize", schedule)
      desktop.removeEventListener("change", schedule)
    }
  }, [rows])

  return (
    // Desktop: the table container fills the remaining height and scrolls both ways, so the header
    // stays pinned. Mobile: it only scrolls sideways and the page scrolls the rows.
    <div ref={wrapper} className="flex flex-col rounded-lg border bg-card md:min-h-0 md:flex-1 md:[&_[data-slot=table-container]]:min-h-0 md:[&_[data-slot=table-container]]:flex-1 md:[&_[data-slot=table-container]]:overflow-auto">
      {/* Fixed layout with explicit widths; the table is as wide as its columns, not the container. */}
      <Table className="w-max table-fixed" style={{ width: visibleCols.reduce((n, c) => n + widths[c], 0) }}>
        <colgroup>
          {visibleCols.map(col => <col key={col} style={{ width: widths[col] }} />)}
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]"
          style={{ transform: "translateY(var(--head-offset, 0px))" }}>
          <TableRow className="hover:bg-transparent">
            {visibleCols.map(col => {
              const active = sort?.col === col
              return (
                <TableHead key={col}
                  aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  <button type="button" onClick={() => onSort(col)}
                    className="inline-flex max-w-full items-center gap-1 font-medium hover:text-foreground">
                    {headers[col]}
                    {active && (sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const on = highlighted.has(row.id)
            return (
              <TableRow key={row.id} tabIndex={0} aria-selected={on}
                onClick={() => onToggleRow(row.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleRow(row.id) }
                }}
                className={cn("cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  on && "bg-highlight hover:bg-highlight")}>
                {visibleCols.map(col => (
                  // Long cells (e.g. player notes) are cut off with an ellipsis; hover shows the full text.
                  <TableCell key={col} title={row.cells[col] || undefined}
                    className={cn("truncate", headers[col] === "Player" && "font-medium")}>
                    {ICON_COLS[headers[col]] || LOGO_COLS[headers[col]] ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        {LOGO_COLS[headers[col]] && row.cells[col] &&
                          <TeamLogo logo={LOGO_COLS[headers[col]](row.cells[col])} />}
                        <span className="min-w-0 truncate"><CellContent value={row.cells[col] ?? ""} /></span>
                        {ICON_COLS[headers[col]]?.map(h => {
                          const label = row.cells[headers.indexOf(h)]
                          return label ? <KeyIcon key={h} label={label} /> : null
                        })}
                      </span>
                    ) : <CellContent value={row.cells[col] ?? ""} />}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
          {!rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={visibleCols.length} className="h-24 text-center text-muted-foreground">
                No rows match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
