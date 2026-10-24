import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AreaChart, BarChart, createTheme, type Series } from "generative-charts"
import "generative-charts/styles.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Row } from "@/lib/sheet"

type Datum = { name: string; count: number }

// Neon Instruments flips its tooltips (dark in light mode, light in dark mode); point them at the
// app's own popover colors instead, and widen the palette so bars can each get their own hue.
const tooltip = {
  tooltipBackground: "var(--popover)", tooltipText: "var(--popover-foreground)", tooltipBorder: "var(--border)",
}
const THEME = createTheme("neon-instruments", {
  id: "recruits",
  name: "Recruits",
  light: { ...tooltip, palette: ["#ff2d55", "#32ade6", "#34c759", "#ff9500", "#af52de", "#007aff", "#ffcc00", "#00c7be", "#a2845e", "#5856d6"] },
  dark: { ...tooltip, palette: ["#ff4569", "#70d7ff", "#32d760", "#ffa51f", "#c66bfa", "#2f95ff", "#ffd60a", "#63e6e2", "#b59469", "#7d7aff"] },
})
const series: Series<Datum>[] = [{ dataKey: "count", label: "Players" }]

// The package colors by series, not by mark, so each category becomes its own series in a stacked
// bar where every row fills only its own column. Colors come from the theme palette, in order.
function perBar(data: Datum[]) {
  const rows = data.map((d, i) => ({ name: d.name, [`s${i}`]: d.count }))
  const cols: Series<Record<string, unknown>>[] = data.map((_, i) => ({ dataKey: `s${i}`, label: "Players" }))
  return { rows, cols }
}

// Follows the app's light/dark toggle, which flips a class on <html>.
function useAppearance() {
  const read = () => (document.documentElement.classList.contains("dark") ? "dark" : "light") as "dark" | "light"
  const [appearance, setAppearance] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setAppearance(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return appearance
}

function countBy(rows: string[][], key: (r: string[]) => string | null, top?: number, foldRest = true): Datum[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const sorted = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  if (!top || sorted.length <= top) return sorted
  if (!foldRest) return sorted.slice(0, top)
  // Past the cap, the tail folds into one "Other" bar rather than more categories.
  const other = sorted.slice(top).reduce((n, d) => n + d.count, 0)
  return [...sorted.slice(0, top), { name: "Other", count: other }]
}

function positionGroup(pos: string) {
  const first = pos.toUpperCase().split("/")[0]
  if (["F", "C", "LW", "RW", "W"].includes(first)) return "Forward"
  if (["D", "LD", "RD"].includes(first)) return "Defense"
  if (first === "G") return "Goalie"
  return null
}

// "27/28" is a recruiting class; skip blanks and typos such as "27/27".
function validClass(s: string) {
  const m = s.match(/^(\d\d)\/(\d\d)$/)
  return m && +m[2] === +m[1] + 1 ? s : null
}

// "Cowichan Valley Capitals (BCHL)" -> "BCHL"
function league(team: string) {
  const m = team.match(/\(([^()]+)\)\s*$/)
  return m ? m[1].trim().toUpperCase() : null
}

// "American (Minnesota)" -> "American"
function nationality(s: string) {
  return s.split("(")[0].trim() || null
}

// Commitments per month over the 24 months ending with the latest one, with empty months kept as 0.
// Dates after the current month (sheet typos) are ignored so they can't stretch the axis.
function byMonth(dates: string[]): Datum[] {
  const now = new Date()
  const thisMonth = now.getFullYear() * 12 + now.getMonth()
  const counts = new Map<number, number>()
  for (const d of dates) {
    const m = d.match(/^(\d{1,2})\/\d{1,2}\/(\d{2}|\d{4})$/)
    if (!m) continue
    const key = (m[2].length === 2 ? 2000 + +m[2] : +m[2]) * 12 + (+m[1] - 1)
    if (key > thisMonth) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (!counts.size) return []
  const last = Math.max(...counts.keys())
  const fmt = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" })
  return Array.from({ length: 24 }, (_, i) => {
    const key = last - 23 + i
    return { name: fmt.format(Date.UTC(Math.floor(key / 12), key % 12)), count: counts.get(key) ?? 0 }
  })
}

function ChartCard({ title, description, children, className }: {
  title: string; description: string; children: ReactNode; className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Bars({ data, appearance, variant, height }: {
  data: Datum[]; appearance: "dark" | "light"; variant: "horizontal" | "vertical"; height: number
}) {
  const { rows, cols } = perBar(data)
  return (
    <BarChart data={rows} categoryKey="name" series={cols} variant={variant} layout="stacked"
      theme={THEME} appearance={appearance} showLegend={false} height={height} />
  )
}

function HBar({ data, appearance }: { data: Datum[]; appearance: "dark" | "light" }) {
  return <Bars data={data} appearance={appearance} variant="horizontal" height={data.length * 30 + 60} />
}

function VBar({ data, appearance }: { data: Datum[]; appearance: "dark" | "light" }) {
  return <Bars data={data} appearance={appearance} variant="vertical" height={260} />
}

type Props = { headers: string[]; rows: Row[]; basis: string }

export function RecruitCharts({ headers, rows, basis }: Props) {
  const appearance = useAppearance()
  const data = useMemo(() => {
    const col = (name: string) => headers.indexOf(name)
    const cells = rows.map(r => r.cells)
    const get = (name: string) => (r: string[]) => r[col(name)] || null
    return {
      months: byMonth(cells.map(r => r[col("Date Committed")] ?? "")),
      conferences: countBy(cells, get("Conference")),
      // No "Other" bar here: the ~50 remaining schools would dwarf the ones shown.
      schools: countBy(cells, get("School"), 15, false),
      classes: countBy(cells, r => validClass(r[col("Class")] ?? ""))
        .sort((a, b) => a.name.localeCompare(b.name)),
      positions: countBy(cells, r => positionGroup(r[col("Position")] ?? "")),
      verification: countBy(cells, r => r[col("Verification")] || "Not marked"),
      leagues: countBy(cells, r => league(r[col("Current Team")] ?? ""), 12),
      nationalities: countBy(cells, r => nationality(r[col("Nationality")] ?? ""), 8),
    }
  }, [rows, headers])

  if (!rows.length) {
    return <p className="py-12 text-center text-muted-foreground">No players match the current filters.</p>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard className="md:col-span-2" title="Commitments by month"
        description={`${basis} by date committed, last 24 months`}>
        <AreaChart data={data.months} xKey="name" series={series} curve="smooth"
          theme={THEME} appearance={appearance} showLegend={false} height={240} />
      </ChartCard>
      <ChartCard title="By conference" description={basis}>
        <HBar appearance={appearance} data={data.conferences} />
      </ChartCard>
      <ChartCard title="By class" description={`${basis}, by recruiting class`}>
        <VBar appearance={appearance} data={data.classes} />
      </ChartCard>
      <ChartCard title="Top schools" description={`${basis}, top 15`}>
        <HBar appearance={appearance} data={data.schools} />
      </ChartCard>
      <div className="grid gap-4">
        <ChartCard title="By position" description={basis}>
          <VBar appearance={appearance} data={data.positions} />
        </ChartCard>
        <ChartCard title="By nationality" description={`${basis}, top 8`}>
          <HBar appearance={appearance} data={data.nationalities} />
        </ChartCard>
      </div>
      <ChartCard title="By verification" description={`${basis}, from the sheet's color key`}>
        <HBar appearance={appearance} data={data.verification} />
      </ChartCard>
      <ChartCard title="Feeder leagues"
        description={`${basis}, by the league of their current team, top 12`}>
        <HBar appearance={appearance} data={data.leagues} />
      </ChartCard>
    </div>
  )
}
