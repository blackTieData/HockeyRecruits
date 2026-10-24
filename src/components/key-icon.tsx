import { useRef, useState } from "react"
import {
  BadgeCheck, CircleCheck, CircleHelp, CircleX, Clock, Info, LogOut, PauseCircle, type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { COMMITMENT_QUESTIONED, TEAM_NOTE, VERIFICATION, type KeyEntry } from "@/lib/key"
import { cn } from "@/lib/utils"

// Each key entry gets its own shape as well as a color, so the icons don't rely on color alone.
const ICONS: Record<string, { Icon: LucideIcon; className: string }> = {
  "Confirmed by school": { Icon: BadgeCheck, className: "text-green-600 dark:text-green-400" },
  "Confirmed on current team": { Icon: CircleCheck, className: "text-muted-foreground" },
  "Not on listed team": { Icon: CircleX, className: "text-red-600 dark:text-red-400" },
  "Team unconfirmed": { Icon: Clock, className: "text-orange-600 dark:text-orange-400" },
  "No longer on team": { Icon: LogOut, className: "text-red-700 dark:text-red-400" },
  "Didn't play last season": { Icon: PauseCircle, className: "text-pink-600 dark:text-pink-400" },
  "Commitment in question": { Icon: CircleHelp, className: "text-amber-600 dark:text-amber-400" },
}

const GROUPS: { title: string; entries: KeyEntry[] }[] = [
  { title: "Verification (next to player)", entries: Object.values(VERIFICATION) },
  { title: "Commitment (next to player)", entries: [COMMITMENT_QUESTIONED] },
  { title: "Team note (next to current team)", entries: Object.values(TEAM_NOTE) },
]
const ENTRIES = new Map(GROUPS.flatMap(g => g.entries).map(e => [e.label, e]))

function Glyph({ label, className }: { label: string; className?: string }) {
  const { Icon, className: color } = ICONS[label]
  return <Icon aria-hidden className={cn("size-4 shrink-0", color, className)} />
}

// A key icon that explains itself: hover with a mouse, or tap / press Enter to toggle.
export function KeyIcon({ label }: { label: string }) {
  const [open, setOpen] = useState(false)
  const pointer = useRef("")
  const entry = ENTRIES.get(label)
  if (!entry) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label}
          className="inline-flex rounded-sm align-middle outline-ring focus-visible:outline-2"
          onPointerDown={e => { pointer.current = e.pointerType }}
          onPointerEnter={e => { if (e.pointerType === "mouse") setOpen(true) }}
          onPointerLeave={e => { if (e.pointerType === "mouse") setOpen(false) }}
          onClick={e => {
            // Keep the click from highlighting the row; preventDefault skips Radix's own toggle.
            e.stopPropagation()
            e.preventDefault()
            setOpen(o => pointer.current === "mouse" ? true : !o)
            pointer.current = ""
          }}>
          <Glyph label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 gap-1 p-3 text-sm"
        onOpenAutoFocus={e => e.preventDefault()} onClick={e => e.stopPropagation()}>
        <p className="font-medium">{entry.label}</p>
        <p className="text-muted-foreground">{entry.description}</p>
      </PopoverContent>
    </Popover>
  )
}

// Toolbar button listing every icon and what it means.
export function KeyLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Info /> Key</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-4 text-sm">
        {GROUPS.map(g => (
          <div key={g.title} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">{g.title}</p>
            {g.entries.map(e => (
              <div key={e.label} className="flex gap-2">
                <Glyph label={e.label} className="mt-0.5" />
                <div>
                  <p className="font-medium">{e.label}</p>
                  <p className="text-muted-foreground">{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">From the color key in the source sheet. Players with no mark have none in the sheet.</p>
      </PopoverContent>
    </Popover>
  )
}
