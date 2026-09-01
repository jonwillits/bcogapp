import { Plot } from './Plot'
import { HISTORY_LEN } from '../sim/world/world'
import { palette } from '../theme/theme'

/**
 * The rolling trace of what the two sensors have been reading.
 *
 * **No heading**, for the same reason as `ActuatorEquation`: the caller names it.
 */
export function SensorTrace({
  history,
  width = 296,
}: {
  history: { left: number[]; right: number[] }
  width?: number
}) {
  return (
    <Plot
      width={width}
      window={HISTORY_LEN}
      series={[
        { color: palette.sensor, data: history.left },
        { color: palette.accent, data: history.right },
      ]}
    />
  )
}
