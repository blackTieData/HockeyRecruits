import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Columns3, Search, X } from "lucide-react"
import { RecruitsTable, type Sort } from "@/components/recruits-table"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compare, loadSheet, type Sheet } from "@/lib/sheet"

// Charts pull in generative-charts, so load them only when the Charts tab is opened.
const RecruitCharts = lazy(() => import("@/components/recruit-charts").then(m => ({ default: m.RecruitCharts })))

const FILTER_COLS = ["Status", "Verification", "Conference", "School", "Class", "Position"]
const ALL = "__all" // Radix Select can't use "" as an item value
const HIDDEN_KEY = "hiddenColumns"

function readHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")) } catch { return new Set() }
}

export default function App() {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<Sort>(null)
  const [hidden, setHidden] = useState(readHidden)
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadSheet().then(setSheet, err => setError(err.message || String(err)))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden])) } catch { /* storage unavailable */ }
  }, [hidden])

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

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Matthew Auchincloss's Very Accurate College Hockey Commitment Tracker</h1>
        <ThemeToggle />
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search players, teams, schools…" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8" aria-label="Search" />
            </div>
            {filterCols.map(col => (
              <Select key={col} value={filters[col] || ALL}
                onValueChange={v => setFilters(f => ({ ...f, [col]: v === ALL ? "" : v }))}>
                <SelectTrigger aria-label={headers[col]} className="max-w-56">
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
          </div>

          <Tabs defaultValue="table">
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
                <KeyLegend />
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
              </div>
            </div>

            <TabsContent value="table" className="mt-2 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Click a row to highlight it; click again to clear. Hover or tap an icon to see what it means.</p>
              <RecruitsTable headers={headers} rows={filtered} allRows={sheet.rows} visibleCols={visibleCols}
                sort={sort} onSort={onSort} highlighted={highlighted} onToggleRow={toggleRow} />
            </TabsContent>
            <TabsContent value="charts" className="mt-2">
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
