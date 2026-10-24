import { useMemo, type ReactNode } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import type { Row } from "@/lib/sheet"

type Datum = { name: string; count: number }

// Every chart is a single series, so they share one hue (slot 1) and need no legend.
const config = { count: { label: "Players", color: "var(--chart-1)" } } satisfies ChartConfig

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

function HBar({ data, labelWidth = 130 }: { data: Datum[]; labelWidth?: number }) {
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 28 + 24 }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }} barCategoryGap={4}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={labelWidth} tickLine={false} axisLine={false}
          interval={0} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ChartContainer>
  )
}

function VBar({ data }: { data: Datum[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full">
      <BarChart data={data} margin={{ left: -16, right: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
  )
}

type Props = { headers: string[]; rows: Row[]; basis: string }

export function RecruitCharts({ headers, rows, basis }: Props) {
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
        <ChartContainer config={config} className="aspect-auto h-56 w-full">
          <AreaChart data={data.months} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2}
              fill="var(--color-count)" fillOpacity={0.15} />
          </AreaChart>
        </ChartContainer>
      </ChartCard>
      <ChartCard title="By conference" description={basis}>
        <HBar data={data.conferences} />
      </ChartCard>
      <ChartCard title="By class" description={`${basis}, by recruiting class`}>
        <VBar data={data.classes} />
      </ChartCard>
      <ChartCard title="Top schools" description={`${basis}, top 15`}>
        <HBar data={data.schools} labelWidth={200} />
      </ChartCard>
      <div className="grid gap-4">
        <ChartCard title="By position" description={basis}>
          <VBar data={data.positions} />
        </ChartCard>
        <ChartCard title="By nationality" description={`${basis}, top 8`}>
          <HBar data={data.nationalities} />
        </ChartCard>
      </div>
      <ChartCard className="md:col-span-2" title="Feeder leagues"
        description={`${basis}, by the league of their current team, top 12`}>
        <HBar data={data.leagues} />
      </ChartCard>
    </div>
  )
}
