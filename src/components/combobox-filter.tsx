import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Props = {
  label: string // column name, e.g. "School"
  options: string[]
  value: string // "" = all
  onChange: (value: string) => void
  className?: string
}

// A filter dropdown you can type into, for columns with many values (e.g. 64 schools).
export function ComboboxFilter({ label, options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)

  function pick(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-label={label}
          className={cn("justify-between font-normal", !value && "text-foreground", className)}>
          <span className="truncate">{value || `All ${label}`}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
        {/* Plain "contains" matching: cmdk's default fuzzy match turns "bost" into Quinnipiac BObcaTS. */}
        <Command filter={(item, search) => item.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0}>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`All ${label}`} onSelect={() => pick("")}>
                All {label}
                <Check className={cn("ml-auto", value ? "opacity-0" : "opacity-100")} />
              </CommandItem>
              {options.map(o => (
                <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                  <span className="truncate">{o}</span>
                  <Check className={cn("ml-auto", value === o ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
