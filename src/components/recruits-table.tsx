import { ArrowDown, ArrowUp } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Row } from "@/lib/sheet"

export type Sort = { col: number; dir: 1 | -1 } | null

type Props = {
  headers: string[]
  rows: Row[]
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

export function RecruitsTable({ headers, rows, visibleCols, sort, onSort, highlighted, onToggleRow }: Props) {
  return (
    // The table container scrolls both ways so the header can stay pinned while scrolling rows.
    <div className="rounded-lg border bg-card [&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            {visibleCols.map(col => {
              const active = sort?.col === col
              return (
                <TableHead key={col}
                  aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  <button type="button" onClick={() => onSort(col)}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground">
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
                    className={cn("max-w-72 truncate", headers[col] === "Player" && "font-medium")}>
                    <CellContent value={row.cells[col] ?? ""} />
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
