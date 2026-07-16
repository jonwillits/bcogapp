import { Suspense, useEffect, useState } from 'react'
import { AppShell } from './shell/AppShell'
import { Home } from './shell/Home'
import { useHashRoute } from './shell/useHashRoute'
import { scenes } from './scenes/registry'

export default function App() {
  const route = useHashRoute()
  const scene = route ? scenes.find((s) => s.route === route) : undefined
  const [labOpen, setLabOpen] = useState(false)

  // Don't carry one scene's open lab pane over to the next scene (or home).
  useEffect(() => setLabOpen(false), [route])

  return (
    <AppShell
      sceneTitle={scene?.title}
      inScene={route !== ''}
      lab={scene?.lab}
      labOpen={labOpen}
      onToggleLab={() => setLabOpen((o) => !o)}
    >
      {route === '' ? (
        <Home />
      ) : scene ? (
        <Suspense fallback={<SceneLoading />}>
          <scene.Component />
        </Suspense>
      ) : (
        <NotFound route={route} />
      )}
    </AppShell>
  )
}

function SceneLoading() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--text-muted)',
      }}
    >
      Loading scene…
    </div>
  )
}

function NotFound({ route }: { route: string }) {
  return (
    <div style={{ padding: 'var(--space)', maxWidth: 640, margin: '0 auto' }}>
      <h2>Scene not found</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        No scene is registered at <code>#/{route}</code>.
      </p>
      <p>
        <a href="#/">← Back to all scenes</a>
      </p>
    </div>
  )
}
