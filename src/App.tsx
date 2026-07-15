import { AppShell } from './shell/AppShell'
import { Home } from './shell/Home'
import { useHashRoute } from './shell/useHashRoute'
import { scenes } from './scenes/registry'

export default function App() {
  const route = useHashRoute()
  const scene = route ? scenes.find((s) => s.route === route) : undefined

  return (
    <AppShell sceneTitle={scene?.title} inScene={route !== ''}>
      {route === '' ? (
        <Home />
      ) : scene ? (
        <scene.Component />
      ) : (
        <NotFound route={route} />
      )}
    </AppShell>
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
