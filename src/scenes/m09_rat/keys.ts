import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Command } from '../../sim/rodent/body'

/**
 * The keys that drive the animal on the tabs where it moves: arrows and
 * WASD. Up or W forward, left and right or A and D turn, down or S a slow
 * step back. Ignored while a text field, slider, select or button has
 * focus, as `CameraRig`'s are; `CameraRig` itself is not mounted on these
 * tabs, so nothing competes for the keys, and on Part 2's tab its own keys
 * stay as they are.
 */

export type DriveKey = 'forward' | 'back' | 'left' | 'right'

const KEY_FOR: Record<string, DriveKey> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'back',
  KeyS: 'back',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

function isInteractive(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) || el.isContentEditable
}

export interface Held {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
}

export function commandOf(h: Held): Command {
  return {
    forward: h.forward && !h.back ? 1 : h.back && !h.forward ? -1 : 0,
    turn: h.left && !h.right ? 1 : h.right && !h.left ? -1 : 0,
  }
}

/** Listen for the drive keys while mounted; the held set lives in a ref the frame loop reads. `enabled` false ignores every key. */
export function useDriveKeys(enabled: boolean): { held: MutableRefObject<Held>; press: (k: DriveKey, down: boolean) => void } {
  const held = useRef<Held>({ forward: false, back: false, left: false, right: false })
  useEffect(() => {
    if (!enabled) {
      held.current = { forward: false, back: false, left: false, right: false }
      return
    }
    const onDown = (e: KeyboardEvent) => {
      const k = KEY_FOR[e.code]
      if (!k || isInteractive(e.target)) return
      held.current[k] = true
      e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const k = KEY_FOR[e.code]
      if (k) held.current[k] = false
    }
    const clear = () => {
      held.current = { forward: false, back: false, left: false, right: false }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [enabled])
  const press = (k: DriveKey, down: boolean) => {
    held.current[k] = down
  }
  return { held, press }
}
