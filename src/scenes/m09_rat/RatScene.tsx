import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Panel } from '../../components/Panel'
import { SceneCanvasLayout } from '../../components/SceneCanvasLayout'
import { makeRng, randomSeed } from '../../sim/random'
import { STILL, type Command, type Pose } from '../../sim/rodent/body'
import { distanceToBoundary } from '../../sim/rodent/shape'
import { RANGE } from '../../sim/rodent/range'
import { BLOCKS } from '../../sim/rodent/homing'
import { AnimalCamera, BOX_SCALE, FOV_NARROW, FOV_NORMAL, RANGE_SCALE, type View } from './AnimalCamera'
import { RatMesh } from './RatMesh'
import { RangeView, NIGHT_SKY } from './RangeView'
import { BoxView } from './BoxView'
import { LabView } from './LabView'
import { commandOf, useDriveKeys } from './keys'
import { Btn, Choice, Content, DrivePad, FixedLines, GroupLabel, Intro, Note, OrientingPanel, PANEL_STYLE, TabBar, statusStyle, type Tab } from './ui'
import { COMMIT_RULE_LINE, RATS_LINE } from './lines'
import { HomeStore, RETURN_LINE } from './homeStore'
import { CellsStore, STEPS } from './cellsStore'
import { RatsStore } from './ratsStore'
import { PatchStore } from './patchStore'
import { travelTime, type Night } from '../../sim/rodent/patch'
/** How far short of a leaf pile's center the forager stands, meters; the pace of its circuit of the rim, m/s; how long a found beetle glints, s. */
const STAND_OFF = 1.1
const RIM_PACE = 0.35
const FLASH = 0.7
import { WorldStore } from './worldStore'
import { HomeLeft, HomeRight, INTRO as HOME_INTRO } from './HomeTab'
import { CellsLeft, CellsRight } from './CellsTab'
import { RatsLeft, RatsRight, RATS_CONTROLS, RATS_INTRO } from './RatsTab'
import { PatchLeft, PatchRight, PATCH_INTRO } from './PatchTab'
import { useStore } from './useStore'

/**
 * Module 9's scene: Lab 9, The Way Home. The fourth instalment of the
 * app's creature spine (M1 vehicle → M4 and M5 bilaterian → M7 fish → M9
 * rat), and the first scene in which the student moves *through* a 3D
 * world rather than looking into one.
 *
 * Five tabs. **World**, the tour. **Home**, Part 1: the student is the
 * forager, finding the nest in the dark, by moonlight, from a picture of
 * home, and after the landmarks have moved; four programmed navigators
 * take the same trips after the commit. **Rats**, Part 2: the student is
 * the experimenter, running a plus maze, a water maze and the radiating
 * paths on a healthy rat and five hidden ones. **Cells**, Part 3: the
 * student is the rat, and simulated head-direction, place, grid and border
 * cells fire beside the view from the rat's estimate of where it is.
 * **Patches**, the closer: when to leave a patch of beetles that is
 * running down.
 *
 * Two camera views, eye and follow, with a toggle that changes nothing in
 * the sim (`AnimalCamera`). The keys drive the animal on the tabs where it
 * moves; `CameraRig` keeps its own keys on the Rats tab.
 */

const DT = 0.02
const MAX_STEPS_PER_FRAME = 6

interface Stores {
  world: WorldStore
  home: HomeStore
  cells: CellsStore
  rats: RatsStore
  patches: PatchStore
}

function makeStores(seed: number): Stores {
  return { world: new WorldStore(seed), home: new HomeStore(seed), cells: new CellsStore(seed), rats: new RatsStore(seed), patches: new PatchStore(seed) }
}

/** The frame loop: fixed steps of the active part, with the keys held, capped so a tab returning from the background does not try to catch up. */
function Stepper({ tab, stores, held, onTick }: { tab: Tab; stores: Stores; held: () => Command; onTick: () => void }) {
  const carry = useRef(0)
  useFrame((_, delta) => {
    carry.current += Math.min(delta, 0.05)
    let steps = 0
    let any = false
    while (carry.current >= DT && steps < MAX_STEPS_PER_FRAME) {
      carry.current -= DT
      steps++
      any = true
      const cmd = held()
      if (tab === 'world') stores.world.step(DT, cmd)
      else if (tab === 'home') stores.home.step(DT, cmd)
      else if (tab === 'cells') stores.cells.tick(DT, cmd)
      else if (tab === 'rats') stores.rats.tick(DT)
      else if (tab === 'patches') stores.patches.tick(DT)
    }
    if (any) onTick()
  })
  return null
}

export default function RatScene() {
  const [tab, setTab] = useState<Tab>('world')
  const [seed, setSeed] = useState(() => randomSeed())
  const [view, setView] = useState<View>('eye')
  const [narrow, setNarrow] = useState(false)
  const [lowDetail, setLowDetail] = useState(false)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const storesRef = useRef<{ seed: number; stores: Stores } | null>(null)
  if (!storesRef.current || storesRef.current.seed !== seed) storesRef.current = { seed, stores: makeStores(seed) }
  const stores = storesRef.current.stores
  const anim = useMemo(() => makeRng(seed ^ 0xa11ce), [seed])
  const drivingTab = tab === 'world' || tab === 'home' || tab === 'cells'
  const { held, press } = useDriveKeys(drivingTab, () => {
    if (tab === 'home') stores.home.here()
  })
  const clockRef = useRef(0)
  useEffect(() => {
    stores.home.setView(view)
  }, [view, stores])

  // A throttled re-render while the sim runs: the panels redraw a few times a second, not every frame.
  const lastPanel = useRef(0)
  const lastRecording = useRef(0)
  const onTick = () => {
    clockRef.current += DT
    const now = performance.now()
    if (now - lastPanel.current > 120) {
      lastPanel.current = now
      bump()
    }
    // The recording panel is memoized and listens to its store: tell it twice a second while the rat moves.
    if (tab === 'cells' && now - lastRecording.current > 500) {
      lastRecording.current = now
      stores.cells.changed()
    }
  }

  // Follow view is always the narrower field (Jon, 2026-10-19: it looks better there); the box narrows eye view.
  const fov = view === 'follow' || narrow ? FOV_NARROW : FOV_NORMAL
  const header = (
    <Panel title="Lab 9: The Way Home" style={{ width: 310 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TabBar tab={tab} onChange={setTab} />
        <Content>{RATS_LINE}</Content>
        <Note>
          Run seed <span style={{ fontFamily: 'var(--font-mono)' }}>{seed}</span>. It fixes every beetle, trial order, start, noise draw and spike.{' '}
          <Btn small onClick={() => setSeed(randomSeed())}>
            New seed
          </Btn>
        </Note>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>View</span>
          <Choice value={view} options={[{ id: 'eye', label: 'Eye view' }, { id: 'follow', label: 'Follow view' }]} onChange={(v) => setView(v as View)} />
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> Narrower view
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={lowDetail} onChange={(e) => setLowDetail(e.target.checked)} /> Low detail
          </label>
        </div>
      </div>
    </Panel>
  )

  const left =
    tab === 'world' ? (
      <WorldLeft header={header} store={stores.world} />
    ) : tab === 'home' ? (
      <HomeLeft store={stores.home} header={header} />
    ) : tab === 'cells' ? (
      <CellsLeft store={stores.cells} header={header} />
    ) : tab === 'rats' ? (
      <RatsLeft store={stores.rats} header={header} />
    ) : (
      <PatchLeft store={stores.patches} header={header} />
    )
  const right = tab === 'home' ? <HomeRight store={stores.home} /> : tab === 'cells' ? <CellsRight store={stores.cells} /> : tab === 'rats' ? <RatsRight store={stores.rats} /> : tab === 'patches' ? <PatchRight store={stores.patches} /> : null

  const clock = () => clockRef.current
  return (
    <SceneCanvasLayout
      canvas={
        <>
          <Canvas camera={{ position: [0, 4, 6], fov: 45, near: 0.01, far: 200 }} onContextMenu={(e) => e.preventDefault()} dpr={lowDetail ? 1 : [1, 1.5]} shadows={false}>
            {tab === 'world' && <WorldCanvas store={stores.world} view={view} fov={fov} lowDetail={lowDetail} anim={anim} clock={clock} />}
            {tab === 'home' && <HomeCanvas store={stores.home} view={view} fov={fov} lowDetail={lowDetail} anim={anim} clock={clock} />}
            {tab === 'cells' && <CellsCanvas store={stores.cells} view={view} fov={fov} anim={anim} />}
            {tab === 'rats' && <RatsCanvas store={stores.rats} anim={anim} />}
            {tab === 'patches' && <PatchCanvas store={stores.patches} view={view} fov={fov} lowDetail={lowDetail} anim={anim} clock={clock} />}
            <Stepper tab={tab} stores={stores} held={() => commandOf(held.current)} onTick={onTick} />
          </Canvas>
          <Overlays tab={tab} stores={stores} />
        </>
      }
      left={left}
      right={right}
      bottom={
        drivingTab || tab === 'patches' ? (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
            {drivingTab && <DrivePad onKey={press} />}
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{drivingTab ? (tab === 'home' ? 'Arrow keys or WASD drive the animal · Enter is “Here is my nest”' : 'Arrow keys or WASD drive the animal') : 'The forager drives itself tonight'}</div>
          </div>
        ) : undefined
      }
    />
  )
}

/** The black between trials, the skip badges, and Part 1's picture of home. */
function Overlays({ tab, stores }: { tab: Tab; stores: Stores }) {
  const home = useStore(stores.home)
  const cells = useStore(stores.cells)
  const patches = useStore(stores.patches)
  const world = useStore(stores.world)
  const rats = useStore(stores.rats)
  const fade = tab === 'home' ? (home.state === 'trials' ? Math.min(1, home.fade / 0.6) : 0) : tab === 'cells' ? Math.min(1, cells.fade / 0.6) : 0
  const badge = tab === 'cells' ? cells.skipBadge : tab === 'patches' ? patches.badge : ''
  const picture = tab === 'home' && home.block === 'picture' && home.state === 'trials' && home.trial
  const homeIntro = tab === 'home' && home.state === 'intro' ? HOME_INTRO[home.block] : null
  const cellsSpec = tab === 'cells' && (cells.state === 'intro' || cells.state === 'predict') ? STEPS.find((st) => st.step === cells.step) : undefined
  return (
    <>
      {fade > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: fade, pointerEvents: 'none' }} data-fade />}
      {homeIntro && <OrientingPanel title={BLOCKS.find((b) => b.id === home.block)!.title} lines={homeIntro.lines} content={homeIntro.content} footer={`${homeIntro.time} Press “Begin” on the left.`} />}
      {cellsSpec && <OrientingPanel title={cellsSpec.title} lines={cellsSpec.what} footer={cells.state === 'intro' ? `About ${cellsSpec.minutes} minutes. Press “Begin” on the left.` : 'Choose a prediction on the left and press “Commit my prediction”.'} />}
      {tab === 'world' && !world.started && <OrientingPanel title={WORLD_INTRO.title} lines={WORLD_INTRO.lines} content={WORLD_INTRO.content} footer={`${WORLD_INTRO.time} Press “Begin” on the left.`} />}
      {tab === 'rats' && !rats.started && <OrientingPanel title={RATS_INTRO.title} lines={RATS_INTRO.lines} content={RATS_INTRO.content} footer={`${RATS_INTRO.time} Press “Begin” on the left.`} />}
      {tab === 'rats' && rats.started && rats.controlsOpen && <OrientingPanel title={RATS_CONTROLS.title} lines={RATS_CONTROLS.lines} footer={RATS_CONTROLS.footer} onClose={() => rats.setControlsOpen(false)} />}
      {tab === 'rats' && rats.started && (
        <div style={{ position: 'absolute', right: 12, bottom: 12 }}>
          <Btn onClick={() => rats.setControlsOpen(!rats.controlsOpen)} primary={rats.controlsOpen}>
            Controls info
          </Btn>
        </div>
      )}
      {tab === 'patches' && !patches.started && <OrientingPanel title={PATCH_INTRO.title} lines={PATCH_INTRO.lines} content={PATCH_INTRO.content} footer={`${PATCH_INTRO.time} Press “Begin” on the left.`} />}
      {badge && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, whiteSpace: 'nowrap' }}>{badge}</div>
      )}
      {tab === 'home' && home.state === 'trials' && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '6px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, width: 260, textAlign: 'center' }}>
          <FixedLines lines={home.statusLines()} lineStyle={statusStyle(RETURN_LINE)} />
        </div>
      )}
      {picture && (
        <div style={{ position: 'absolute', right: 12, bottom: 64, width: 300, height: 170, border: '2px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: NIGHT_SKY }} data-picture>
          <Canvas camera={{ position: [0, RANGE_SCALE.eye, 0], fov: 75, near: 0.01, far: 200 }} frameloop="demand" dpr={1}>
            <RangeView light="moonlight" lowDetail pose={() => ({ x: 0, y: 0, heading: Math.PI / 2 })} showNest={false} clock={() => 0} />
            <NestCamera />
          </Canvas>
          <div style={{ position: 'absolute', left: 6, bottom: 4, fontSize: 10, color: 'var(--text-muted)' }}>the view from the nest, facing north</div>
        </div>
      )}
    </>
  )
}

/** The still picture's camera: at the nest, eye height, facing north. */
function NestCamera() {
  useFrame(({ camera }) => {
    camera.position.set(0, RANGE_SCALE.eye, 0)
    camera.lookAt(new THREE.Vector3(0, RANGE_SCALE.eye, -1))
  })
  return null
}

/** Part 0's orienting text, shown over the view until Begin. */
const WORLD_INTRO = {
  title: 'Part 0 — Opening the simulation',
  lines: [
    'You are a small mammal on the forest floor at night, a few steps from your nest under its root. This tab is for finding your feet: nothing is scored, and you can come back to it at any time.',
    'The keys. Up arrow or W walks forward at a steady pace. Left and right arrows, or A and D, turn. Down arrow or S steps back slowly. The buttons under the view do the same on a touch screen. Keys are ignored while a control has focus; click on the view to drive again.',
    'The two views. Eye view is the animal’s own eyes, low to the ground. Follow view sits behind the animal and a little above it, and shows no more of the world than the eye view does. Switch at any time with the View buttons in the panel on the left.',
    'Comfort. There is no head bob and the pace is constant. Follow view uses a narrower field; the Narrower view box narrows the eye view too. Low detail halves the draw distance and the ground clutter for a slower machine; it changes nothing the sim does.',
    'The parts. Home: you find the way home, as the forager and as the subject of an experiment. Rats: you run experiments on a healthy rat and six hidden ones. Cells: you are the rat, and simulated cells fire beside the view. Patches: when to leave a patch of beetles. Each part, and each step, opens with a panel like this one.',
  ],
  content: [COMMIT_RULE_LINE],
  time: 'About 3 minutes.',
}

function WorldLeft({ header, store }: { header: React.ReactNode; store: WorldStore }) {
  const s = useStore(store)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}
      <Panel title="Part 0 — Opening the simulation" style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!s.started && <Intro time={WORLD_INTRO.time} onBegin={() => s.begin()} />}
          <Note>Drive about, in both views, until the keys feel natural. Nothing is scored.</Note>
          <GroupLabel>The rule of the lab</GroupLabel>
          <Content>{COMMIT_RULE_LINE}</Content>
        </div>
      </Panel>
    </div>
  )
}

function WorldCanvas({ store, view, fov, lowDetail, anim, clock }: { store: WorldStore; view: View; fov: number; lowDetail: boolean; anim: ReturnType<typeof makeRng>; clock: () => number }) {
  const pose = () => store.body.pose
  return (
    <>
      <RangeView light="moonlight" lowDetail={lowDetail} pose={pose} showNest clock={clock} />
      <RatMesh pose={pose} anim={anim} moving={() => store.body.lastStep !== 0 || store.body.lastTurn !== 0} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={RANGE_SCALE} />
    </>
  )
}

function HomeCanvas({ store, view, fov, lowDetail, anim, clock }: { store: HomeStore; view: View; fov: number; lowDetail: boolean; anim: ReturnType<typeof makeRng>; clock: () => number }) {
  const s = useStore(store)
  const t = s.trial
  const pose = (): Pose => (t ? t.body.pose : { x: 0, y: 0, heading: Math.PI / 2 })
  const light = t ? (t.blackout > 0 ? 'dark' : t.light) : 'moonlight'
  // The nest is drawn in practice and between blocks, never at a trial's end: how far off the student ended waits for the commit.
  const showNest = !t || s.block === 'practice'
  return (
    <>
      <RangeView light={light} lowDetail={lowDetail} pose={pose} showNest={showNest} treeHidden={t?.plan.treeHidden} moved={t?.moved ?? null} bare={t?.plan.bare} beetle={t?.currentBeetle ?? null} clock={clock} />
      <RatMesh pose={pose} anim={anim} moving={() => !!t && (t.body.lastStep !== 0 || t.body.lastTurn !== 0)} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={RANGE_SCALE} />
    </>
  )
}

function CellsCanvas({ store, view, fov, anim }: { store: CellsStore; view: View; fov: number; anim: ReturnType<typeof makeRng> }) {
  const s = useStore(store)
  const session = s.session
  const pose = () => session.body.pose
  const shape = session.room.shape
  const confine = (x: number, y: number): [number, number] => {
    const r = Math.hypot(x, y)
    if (r < 1e-6) return [x, y]
    const d = distanceToBoundary(shape, 0, 0, x / r, y / r, 0.03)
    return r > d ? [(x / r) * d, (y / r) * d] : [x, y]
  }
  return (
    <>
      <BoxView room={session.room} lit={session.lit} pose={pose} cardMoved={session.cardMoved} />
      <RatMesh pose={pose} anim={anim} moving={() => session.body.lastStep !== 0 || session.body.lastTurn !== 0} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={BOX_SCALE} confine={confine} />
    </>
  )
}

function RatsCanvas({ store, anim }: { store: RatsStore; anim: ReturnType<typeof makeRng> }) {
  const s = useStore(store)
  const dark = s.settings.darkness === 'fromStart' || (s.settings.darkness === 'afterStart' && s.clock > 1.5)
  return <LabView settings={s.settings} apparatus={s.settings.apparatus} dark={dark} testing={s.result !== null && !s.showingTraining} currentPath={s.playing ? s.currentPath : null} pastPaths={s.pastPaths} clock={() => s.clock} anim={anim} />
}

function PatchCanvas({ store, view, fov, lowDetail, anim, clock }: { store: PatchStore; view: View; fov: number; lowDetail: boolean; anim: ReturnType<typeof makeRng>; clock: () => number }) {
  const s = useStore(store)
  const headingRef = useRef(0)
  const lastRef = useRef({ x: 0, y: 0 })
  // Where the forager stands: a step short of the pile, on the side it came from, so neither camera sits inside the pile
  // (Jon's walk, 2026-10-20: the forager stood at the pile's center and the view showed the inside of the pile). The stand
  // point of the current patch is held from arrival; the walk goes from it to the next patch's stand point.
  const standRef = useRef<{ night: Night | null; patches: number; at: { x: number; y: number }; leftFrom: { x: number; y: number } | null }>({ night: null, patches: -1, at: { x: 0, y: 0 }, leftFrom: null })
  const standBefore = (pile: { x: number; y: number }, from: { x: number; y: number }) => {
    const d = Math.hypot(pile.x - from.x, pile.y - from.y) || 1
    return { x: pile.x - (STAND_OFF * (pile.x - from.x)) / d, y: pile.y - (STAND_OFF * (pile.y - from.y)) / d }
  }
  // In a patch the forager works the pile's rim, a slow circuit at STAND_OFF from the center starting where it arrived
  // (Jon, 2026-10-20: it had sat still until it left). A beetle glints at its nose for a moment at each beetle event.
  const flashRef = useRef<{ t: number; at: { x: number; y: number } } | null>(null)
  const pose = (): Pose => {
    const n = s.night
    if (!n) return { x: 0, y: 0, heading: Math.PI / 2 }
    const st = standRef.current
    if (st.night !== n || st.patches !== n.patches) {
      // A new night, or an arrival: the stand point is a step short of this pile, on the side the walk came from.
      const from = st.night === n ? st.at : { x: 0, y: 0 }
      st.night = n
      st.patches = n.patches
      st.at = standBefore(n.patchAt, from)
      st.leftFrom = null
    }
    let p = st.at
    let heading = headingRef.current
    if (n.phase === 'traveling') {
      // The walk starts from wherever the circuit had got to when the rule said leave.
      if (!st.leftFrom) st.leftFrom = lastRef.current
      const to = standBefore(n.nextPatch, st.leftFrom)
      const k = 1 - n.traveling / travelTime(n.habitat)
      p = { x: st.leftFrom.x + k * (to.x - st.leftFrom.x), y: st.leftFrom.y + k * (to.y - st.leftFrom.y) }
    } else {
      const a0 = Math.atan2(st.at.y - n.patchAt.y, st.at.x - n.patchAt.x)
      const a = a0 + (RIM_PACE / STAND_OFF) * n.inPatch
      p = { x: n.patchAt.x + STAND_OFF * Math.cos(a), y: n.patchAt.y + STAND_OFF * Math.sin(a) }
      heading = a + Math.PI / 2
    }
    const last = n.events[n.events.length - 1]
    if (last && last.kind === 'beetle' && n.time - last.t < FLASH && (!flashRef.current || flashRef.current.t !== last.t)) {
      flashRef.current = { t: last.t, at: { x: p.x + 0.25 * Math.cos(heading), y: p.y + 0.25 * Math.sin(heading) } }
    }
    const dx = p.x - lastRef.current.x
    const dy = p.y - lastRef.current.y
    if (n.phase === 'traveling' && Math.hypot(dx, dy) > 1e-4) heading = Math.atan2(dy, dx)
    headingRef.current = heading
    lastRef.current = p
    return { x: p.x, y: p.y, heading }
  }
  const beetle = (): { x: number; y: number } | null => {
    const n = s.night
    const f = flashRef.current
    return n && f && n.time - f.t < FLASH ? f.at : null
  }
  const patches = s.night ? [s.night.patchAt, s.night.nextPatch] : []
  return (
    <>
      <RangeView light="moonlight" lowDetail={lowDetail} pose={pose} showNest patches={patches} liveBeetle={beetle} clock={clock} />
      <RatMesh pose={pose} anim={anim} moving={() => !!s.night && s.playing} visible={view === 'follow'} />
      <AnimalCamera pose={pose} view={view} fov={fov} scale={RANGE_SCALE} />
    </>
  )
}

export { STILL, RANGE }
