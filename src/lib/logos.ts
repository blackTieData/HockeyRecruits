// Looks up local logo files (downloaded by scripts/fetch-logos.py) for schools and junior teams.

import manifest from "@/lib/logos.json"

export type Logo = {
  src: string
  dark?: string // variant for dark backgrounds
  invert?: boolean // white-only logo: invert it on light backgrounds
  title: string // what the logo depicts, e.g. the league name when falling back to a league logo
}

type Team = { name: string; league: string; aliases: string[]; src: string }
type League = { src: string; dark?: string; invert?: boolean }

// "Saint John Sea Dogs", "St. John Sea Dogs" and "Saint-John Sea-Dogs" all become "saintjohnseadogs".
// Also drops accents ("Québec" -> "quebec"), "œ" ligatures and "Jr." ("Danbury Jr. Hat Tricks").
function norm(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/œ/g, "oe")
    .split(/[^a-z0-9']+/).filter(w => w && w !== "jr")
    .map(w => (w === "st" ? "saint" : w).replace(/'/g, ""))
    .join("")
}

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const schools = new Map<string, Logo>()
for (const s of manifest.ncaa as { names: string[]; src: string; dark?: string }[]) {
  for (const name of s.names) schools.set(norm(name), { src: s.src, dark: s.dark, title: s.names[0] })
}

const teams = manifest.teams as Team[]
const teamsByName = new Map<string, Team>()
for (const t of teams) for (const n of [t.name, ...t.aliases]) teamsByName.set(norm(n), t)
const leagues = manifest.leagues as Record<string, League>

export function schoolLogo(school: string): Logo | null {
  return schools.get(norm(school)) ?? null
}

const teamCache = new Map<string, Logo | null>()

// "Cowichan Valley Capitals (BCHL)" -> that team's logo; otherwise its league's logo; otherwise null.
// Matches on the team name rather than the league label, since the sheet sometimes has the wrong league
// ("Brandon Wheat Kings (OHL)") and small typos ("Kelowna Rockerts").
export function teamLogo(currentTeam: string): Logo | null {
  if (teamCache.has(currentTeam)) return teamCache.get(currentTeam)!
  const m = currentTeam.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  const name = norm(m ? m[1] : currentTeam)
  const label = m?.[2].trim().toUpperCase()

  let team = teamsByName.get(name)
  if (!team && name.length >= 8) {
    // One or two typos, as long as exactly one team is that close.
    const near = teams.filter(t => [t.name, ...t.aliases].some(n => editDistance(norm(n), name) <= 2))
    if (near.length === 1) team = near[0]
  }
  if (!team && label) {
    // A dropped word ("Cowichan Capitals"): same city start and nickname within the labeled league.
    const near = teams.filter(t => {
      const words = t.name.split(" ")
      return t.league === label && name.endsWith(norm(words.at(-1)!)) && name.startsWith(norm(words[0]))
    })
    if (near.length === 1) team = near[0]
  }

  const league = label ? leagues[label] : undefined
  const logo: Logo | null = team
    ? { src: team.src, title: team.name }
    : league ? { ...league, title: `${label} logo` } : null
  teamCache.set(currentTeam, logo)
  return logo
}
