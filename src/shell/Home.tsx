import styles from './Home.module.css'
import { scenes, plannedModules } from '../scenes/registry'

/**
 * The scene picker. Built scenes render as clickable cards; the remaining
 * planned modules render as muted cards so the course's scope is visible
 * before those scenes exist. A planned module is hidden once a real scene
 * for it has been registered (it moves up into the built grid).
 */
export function Home() {
  const builtModules = new Set(scenes.map((s) => s.module))
  const planned = plannedModules.filter((p) => !builtModules.has(p.module))

  return (
    <div className={styles.home}>
      <div className={styles.header}>
        <h1>Brain &amp; Cognitive Science — Interactive Scenes</h1>
        <p className={styles.lede}>
          In-class demonstrations and student lab activities for BCOG&nbsp;100.
          Most scenes are stages of one evolving-creature simulation that grows
          with the course; a few are standalone satellite demos.
        </p>
      </div>

      <div className={styles.sectionLabel}>Available</div>
      {scenes.length === 0 ? (
        <p className={styles.emptyNote}>
          No scenes built yet — the first (Module&nbsp;1 vehicles) is on the way.
        </p>
      ) : (
        <div className={styles.grid}>
          {scenes.map((s) => (
            <a
              key={s.route}
              className={`${styles.card} ${styles.cardActive}`}
              href={`#/${s.route}`}
            >
              <div className={styles.cardTop}>
                <span className={styles.module}>M{s.module}</span>
                <span className={styles.cardTitle}>{s.title}</span>
                <span className={styles.mode}>{s.mode}</span>
              </div>
              <div className={styles.blurb}>{s.blurb}</div>
            </a>
          ))}
        </div>
      )}

      {planned.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Planned</div>
          <div className={styles.grid}>
            {planned.map((p) => (
              <div
                key={p.module}
                className={`${styles.card} ${styles.cardPlanned}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.module}>M{p.module}</span>
                  <span className={styles.cardTitle}>{p.title}</span>
                </div>
                <div className={styles.blurb}>{p.idea}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
