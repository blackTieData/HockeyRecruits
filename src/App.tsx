import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Columns3, Menu, Search, X } from "lucide-react"
import { RecruitsTable, type Sort } from "@/components/recruits-table"
import { PAGE_SIZES, TablePagination, type PageSize } from "@/components/table-pagination"
import { ComboboxFilter } from "@/components/combobox-filter"
import { KeyLegend } from "@/components/key-icon"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compare, loadSheet, type Sheet as SheetData } from "@/lib/sheet"
import { cn } from "@/lib/utils"

// Charts pull in generative-charts, so load them only when the Charts tab is opened.
const RecruitCharts = lazy(() => import("@/components/recruit-charts").then(m => ({ default: m.RecruitCharts })))

const TITLE = "Matthew Auchincloss's Very Accurate College Hockey Commitment Tracker"

const FILTER_COLS = ["Status", "Verification", "Conference", "School", "Class", "Position"]
const ALL = "__all" // Radix Select can't use "" as an item value
const HIDDEN_KEY = "hiddenColumns"

const PAGE_SIZE_KEY = "pageSize"

function readPageSize(): PageSize {
  try {
    const v = localStorage.getItem(PAGE_SIZE_KEY)
    return (PAGE_SIZES as readonly string[]).includes(v ?? "") ? v as PageSize : "50"
  } catch { return "50" }
}

function readHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")) } catch { return new Set() }
}

export default function App() {
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<Sort>(null)
  const [hidden, setHidden] = useState(readHidden)
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set())
  const [pageSize, setPageSize] = useState(readPageSize)
  const [page, setPage] = useState(0)

  useEffect(() => {
    loadSheet().then(setSheet, err => setError(err.message || String(err)))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])) } catch { /* storage unavailable */ }
  }, [hidden])

  useEffect(() => {
    try { localStorage.setItem(PAGE_SIZE_KEY, pageSize) } catch { /* storage unavailable */ }
  }, [pageSize])

  // A new search, filter, sort or page size starts again from the first page.
  useEffect(() => { setPage(0) }, [search, filters, sort, pageSize])

  const headers = sheet?.headers ?? []
  const filterCols = FILTER_COLS.map(name => headers.indexOf(name)).filter(col => col >= 0)

  const options = useMemo(() => Object.fromEntries(filterCols.map(col =>
    [col, [...new Set(sheet!.rows.map(r => r.cells[col]).filter(Boolean))].sort(compare)])),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [sheet])

  const filtered = useMemo(() => {
    if (!sheet) return []
    const q = search.trim().toLowerCase()
    const view = sheet.rows.filter(r =>
      filterCols.every(col => !filters[col] || r.cells[col] === filters[col]) &&
      (!q || r.cells.some(c => c.toLowerCase().includes(q))))
    if (sort) view.sort((a, b) => sort.dir * compare(a.cells[sort.col] ?? "", b.cells[sort.col] ?? ""))
    return view
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, search, filters, sort])

  const statusCol = headers.indexOf("Status")
  const statusFilter = filters[statusCol]
  // Without a status filter, charts count committed players only, so recent-commit and
  // tracking rows don't double count or inflate the totals.
  const chartRows = statusFilter ? filtered : filtered.filter(r => r.cells[statusCol] === "Committed")
  const basis = statusFilter ? `${statusFilter} players` : "Committed players"

  const stats = useMemo(() => {
    const by = (s: string) => filtered.filter(r => r.cells[statusCol] === s)
    const committed = by("Committed")
    const schoolCol = headers.indexOf("School")
    return [
      { label: "Committed", value: committed.length },
      { label: "Decommits", value: by("Decommit").length },
      { label: "Tracking", value: by("Tracking").length },
      { label: "Schools with commits", value: new Set(committed.map(r => r.cells[schoolCol])).size },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  const perPage = pageSize === "all" ? Math.max(filtered.length, 1) : Number(pageSize)
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = useMemo(
    () => filtered.slice(currentPage * perPage, (currentPage + 1) * perPage),
    [filtered, currentPage, perPage])

  const visibleCols = headers.map((_, i) => i).filter(i => !hidden.has(headers[i]))
  const active = !!search || Object.values(filters).some(Boolean)

  function toggleColumn(name: string, show: boolean) {
    const next = new Set(hidden)
    if (show) next.delete(name)
    else if (visibleCols.length > 1) next.add(name) // always keep at least one column
    setHidden(next)
  }

  function toggleRow(id: number) {
    const next = new Set(highlighted)
    if (!next.delete(id)) next.add(id)
    setHighlighted(next)
  }

  function onSort(col: number) {
    setSort(s => ({ col, dir: s?.col === col ? (-s.dir as 1 | -1) : 1 }))
  }

  const filterControls = (stacked: boolean) => (
    <>
      <div className={cn("relative", stacked ? "w-full" : "min-w-48 flex-1")}>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" placeholder="Search players, teams, schools…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-8" aria-label="Search" />
      </div>
      {filterCols.map(col => headers[col] === "School" ? (
        // Dozens of schools: a dropdown you can type into.
        <ComboboxFilter key={col} label={headers[col]} options={options[col] ?? []} value={filters[col] || ""}
          onChange={v => setFilters(f => ({ ...f, [col]: v }))} className={stacked ? "w-full" : "max-w-56"} />
      ) : (
        <Select key={col} value={filters[col] || ALL}
          onValueChange={v => setFilters(f => ({ ...f, [col]: v === ALL ? "" : v }))}>
          <SelectTrigger aria-label={headers[col]} className={stacked ? "w-full" : "max-w-56"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All {headers[col]}</SelectItem>
            {options[col]?.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {active && (
        <Button variant="ghost" onClick={() => { setSearch(""); setFilters({}) }}>
          <X /> Reset
        </Button>
      )}
    </>
  )

  const columnsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Columns3 /> Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {headers.map(h => (
          <DropdownMenuCheckboxItem key={h} checked={!hidden.has(h)}
            onCheckedChange={v => toggleColumn(h, !!v)}
            onSelect={e => e.preventDefault()}>
            {h}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hidden.size} onSelect={() => setHidden(new Set())}>
          Show all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    // Desktop: the app fills the viewport and only the table (or charts) scrolls.
    // Mobile: the page scrolls, so everything above the table scrolls away under the sticky title bar.
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:h-dvh md:p-6">
      <header data-site-header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:static md:m-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight md:text-2xl" title={TITLE}>{TITLE}</h1>
        <div className="hidden md:block"><ThemeToggle /></div>
        {sheet && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative md:hidden" aria-label="Filters and options">
                <Menu />
                {active && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] gap-0 overflow-y-auto"
              onOpenAutoFocus={e => e.preventDefault() /* don't pop the phone keyboard open */}>
              <SheetHeader>
                <SheetTitle>Filters & options</SheetTitle>
                <SheetDescription className="tabular-nums">
                  {filtered.length.toLocaleString()} of {sheet.rows.length.toLocaleString()} rows
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 pb-4">
                {filterControls(true)}
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-4">
                  {columnsMenu}
                  <KeyLegend />
                  <ThemeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </header>

      {error && <p role="alert" className="text-destructive">{error}</p>}

      {!sheet && !error && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      )}

      {sheet && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map(s => (
              <Card key={s.label} size="sm">
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <div className="text-3xl font-semibold tabular-nums">{s.value.toLocaleString()}</div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* On mobile these live in the hamburger sheet instead. */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {filterControls(false)}
          </div>

          <Tabs defaultValue="table" className="md:min-h-0 md:flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {filtered.length === sheet.rows.length
                    ? `${sheet.rows.length.toLocaleString()} rows`
                    : `${filtered.length.toLocaleString()} of ${sheet.rows.length.toLocaleString()} rows`}
                </span>
                {highlighted.size > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setHighlighted(new Set())}>
                    <span className="size-2.5 rounded-full bg-highlight ring-1 ring-foreground/20" />
                    Clear {highlighted.size} highlighted
                  </Button>
                )}
                <div className="hidden items-center gap-2 md:flex">
                  <KeyLegend />
                  {columnsMenu}
                </div>
              </div>
            </div>

            <TabsContent value="table" className="mt-2 flex flex-col gap-2 md:min-h-0 md:flex-1">
              <p className="text-sm text-muted-foreground">Click or tap a row to highlight it; again to clear. Hover or tap an icon to see what it means.</p>
              <RecruitsTable headers={headers} rows={pageRows} allRows={sheet.rows} visibleCols={visibleCols}
                sort={sort} onSort={onSort} highlighted={highlighted} onToggleRow={toggleRow} />
              <TablePagination page={currentPage} pageCount={pageCount} pageSize={pageSize}
                total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
            </TabsContent>
            <TabsContent value="charts" className="mt-2 md:min-h-0 md:flex-1 md:overflow-y-auto">
              <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
                <RecruitCharts headers={headers} rows={chartRows} basis={basis} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
