// The sheet's color key, turned into data. Colors are the exact RGB fills/fonts the sheet uses.

export type KeyEntry = { label: string; description: string }

// Fill on the player's name.
export const VERIFICATION: Record<string, KeyEntry> = {
  "00FF00": { label: "Confirmed by school", description: "Confirmed by the school, or an active NCAA player for the school." },
  "93C47D": { label: "Confirmed on current team", description: "Confirmed to be on the team listed under Current Team." },
  "EA9999": { label: "Not on listed team", description: "Not on the team listed under Current Team; current team unknown." },
  "F9CB9C": { label: "Team unconfirmed", description: "Team not confirmed, but the last known team hasn't published a roster yet." },
}

// Text color on the Current Team cell.
export const TEAM_NOTE: Record<string, KeyEntry> = {
  "B31313": { label: "No longer on team", description: "Last known team; not there currently." },
  "FFA7D3": { label: "Didn't play last season", description: "Last known team, but did not play last season." },
}

// Fill on the Class cell.
export const COMMITMENT_QUESTIONED_FILL = "FFFF00"
export const COMMITMENT_QUESTIONED: KeyEntry = {
  label: "Commitment in question",
  description: "There is a question about this commitment.",
}
