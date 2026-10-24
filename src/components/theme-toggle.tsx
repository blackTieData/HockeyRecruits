import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

// Light/dark toggle; dark is the default (set in index.html) and the choice is remembered per browser.
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch { /* storage unavailable */ }
    setDark(next)
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun /> : <Moon />}
      {dark ? "Light" : "Dark"}
    </Button>
  )
}
