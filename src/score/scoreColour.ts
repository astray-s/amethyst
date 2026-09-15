/** Returns the accent colour for a given score value (0–100). */
export function scoreColour(score: number): string {
  if (score < 40) return '#ef4444';  // red — needs work
  if (score < 60) return '#f97316';  // orange — getting there
  if (score < 75) return '#eab308';  // yellow — decent
  if (score < 90) return '#a855f7';  // purple — good
  return '#22c55e';                  // green — excellent
}
