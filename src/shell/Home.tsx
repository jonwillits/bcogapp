import styles from './Home.module.css'
import {
  MODULES,
  scenes,
  plannedScenes,
  type SceneManifest,
  type PlannedScene,
} from '../scenes/registry'

interface ModuleGroup {
  module: number
  title: string
  built: SceneManifest[]
  planned: PlannedScene[]
}

/**
 * The scene picker, grouped into one row per course module. A module appears
 * only once it has at least one demo (built or planned), so the page has no
 * empty rows; new rows show up automatically as ideas land in the registry.
 * Module identity lives in the row header, so the cards carry no module badge.
 */
export function Home() {
  const groups: ModuleGroup[] = MODULES.map((m) => ({
    module: m.module,
    title: m.title,
    built: scenes.filter((s) => s.module === m.module),
    planned: plannedScenes.filter((p) => p.module === m.module),
  })).filter((g) => g.built.length + g.planned.length > 0)

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

      {groups.map((g) => (
        <section className={styles.module} key={g.module}>
          <div className={styles.moduleHeader}>
            <span className={styles.moduleNumber}>Module {g.module}</span>
            <h2 className={styles.moduleTitle}>{g.title}</h2>
          </div>

          <div className={styles.grid}>
            {g.built.map((s) => (
              <a
                key={s.route}
                className={`${styles.card} ${styles.cardActive}`}
                href={`#/${s.route}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{s.title}</span>
                  <span className={styles.tag}>{s.mode}</span>
                </div>
                <div className={styles.blurb}>{s.blurb}</div>
              </a>
            ))}

            {g.planned.map((p) => (
              <div
                key={`${p.module}-${p.title}`}
                className={`${styles.card} ${styles.cardPlanned}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{p.title}</span>
                  <span className={styles.tag}>planned</span>
                </div>
                <div className={styles.blurb}>{p.idea}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
