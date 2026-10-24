import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const PAGE_SIZES = ["50", "100", "250", "all"] as const
export type PageSize = (typeof PAGE_SIZES)[number]

type Props = {
  page: number // zero-based, already clamped to the page count
  pageCount: number
  pageSize: PageSize
  total: number
  onPage: (page: number) => void
  onPageSize: (size: PageSize) => void
}

export function TablePagination({ page, pageCount, pageSize, total, onPage, onPageSize }: Props) {
  const size = pageSize === "all" ? total : Number(pageSize)
  const first = total ? page * size + 1 : 0
  const last = Math.min(total, (page + 1) * size)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select value={pageSize} onValueChange={v => onPageSize(v as PageSize)}>
          <SelectTrigger size="sm" aria-label="Rows per page" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums" aria-live="polite">
          {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="First page" disabled={page === 0} onClick={() => onPage(0)}>
              <ChevronsLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
              <ChevronLeft />
            </Button>
            <span className="px-1 tabular-nums">Page {page + 1} of {pageCount}</span>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
              <ChevronRight />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Last page" disabled={page >= pageCount - 1} onClick={() => onPage(pageCount - 1)}>
              <ChevronsRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
