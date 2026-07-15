import { useEffect, useState } from 'react'

/**
 * Current hash route, normalized. `#/m01-vehicles` → `'m01-vehicles'`,
 * `''` / `#` / `#/` → `''` (the home / scene-picker route).
 *
 * Hash routing (not history routing) is deliberate: deep links keep working
 * offline inside the installed PWA and under any static-host subpath.
 */
export function getHashRoute(): string {
  return window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '')
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(getHashRoute)
  useEffect(() => {
    const onChange = () => setRoute(getHashRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** Navigate to a scene route (or home when route is ''). */
export function navigate(route: string): void {
  window.location.hash = route ? `#/${route}` : '#/'
}
