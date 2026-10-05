/**
 * `fmt`, with the minus sign's place always kept: a figure space stands
 * where the sign would be. **Any live number that can go negative and sits
 * in running text, or on a line that could wrap, is printed with this**, so
 * a change of sign never changes the line's length and nothing below it
 * moves.
 */
export function fmtSigned(n: number, digits = 2): string {
  const zero = 0.5 / 10 ** digits
  const v = Math.abs(n) < zero ? 0 : n
  return (v < 0 ? '−' : '\u2007') + Math.abs(v).toFixed(digits)
}

/** Format for display: a real minus sign, 2dp, and no "−0.00". */
export function fmt(n: number): string {
  const v = Math.abs(n) < 0.005 ? 0 : n
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2)
}
