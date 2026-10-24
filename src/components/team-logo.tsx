import { useState } from "react"
import type { Logo } from "@/lib/logos"
import { cn } from "@/lib/utils"

// A small logo shown before a school or team name. The name follows it in the cell, so the image
// is decorative (empty alt); its title says what it is. Renders nothing if the file fails to load.
export function TeamLogo({ logo }: { logo: Logo | null }) {
  const [failed, setFailed] = useState(false)
  if (!logo || failed) return null

  const img = (src: string, className?: string) => (
    <img src={src} alt="" title={logo.title} loading="lazy" decoding="async" onError={() => setFailed(true)}
      className={cn("size-5 shrink-0 object-contain", logo.invert && "invert dark:invert-0", className)} />
  )
  // Theme is a class on <html>, so swap the dark-background variant with CSS rather than <picture>.
  return logo.dark
    ? <>{img(logo.src, "dark:hidden")}{img(logo.dark, "hidden dark:block")}</>
    : img(logo.src)
}
