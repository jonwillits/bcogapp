/** Format for display: a real minus sign, 2dp, and no "−0.00". */
export function fmt(n: number): string {
  const v = Math.abs(n) < 0.005 ? 0 : n
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2)
}
