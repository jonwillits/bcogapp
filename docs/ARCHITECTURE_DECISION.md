# Architecture Decision

**Status: DECIDED (2026-07-13).** Web-first, shipped as an installable **PWA**, rendered with **Three.js + react-three-fiber**, with the simulation/neural logic as a plain **TypeScript** layer and inspection UI in **React/DOM**. Native desktop installers (Tauri) are **deferred** until a concrete need appears. Reasoning and the alternatives considered are below; the short version is in the [decision log](#decision-log).

The decision was made *after* walking through the lab ideas in [`LAB_IDEAS.md`](LAB_IDEAS.md), which surfaced two facts that settled it: (1) the labs form a single **evolving-creature simulation** plus a few satellite scenes — one engine, not a grab-bag; and (2) the load is tiny (usually one focal creature; at most ~two full neural networks, in the social-cognition week), so the Chromebook performance ceiling is a non-issue.

## The one fact that constrains everything

The app must run on **Chromebook** alongside Mac/Windows/Linux. Chromebooks cannot be counted on to run native binaries across a whole class:

- **Linux (Crostini) container** — off by default, varies by model and admin policy, and asks students to run terminal setup. Not something we can require.
- **Android apps** — available on many but not all Chromebooks, and a poor fit for a keyboard-and-mouse 3D lab.
- **The browser** — the *one* runtime present and identical on every Chromebook, Mac, Windows, and Linux machine.

So: **whatever a Chromebook must display has to run in the browser.** That is not a preference; it's forced by the platform list. Everything below follows from it.

## Why this does *not* rule out interactive 3D (addressing the skepticism)

A reasonable worry is that "web app" means "no real 3D / no camera control / weak performance." That was true fifteen years ago; it isn't now.

- **WebGL** (based on OpenGL ES) is supported on every current browser, including Chrome OS, and gives hardware-accelerated real-time 3D. **WebGPU** (the newer, faster API, ~Vulkan/Metal-class) is now shipping in Chrome and hence on Chromebooks, with more headroom.
- **Free camera control** — orbit, fly, first-person/pointer-lock — is completely standard on the web (e.g., Three.js ships `OrbitControls`, `FlyControls`, `PointerLockControls`). This is a solved problem, not a research project.
- Production 3D runs in browsers today: Google Earth, CAD tools, architectural walkthroughs, and countless Three.js/Babylon.js scenes. Scientific demos with a few thousand elements are well within a Chromebook's range.

The honest caveat is **performance headroom on low-end Chromebooks**, not capability. A flythrough of a labeled brain or a small spatial environment is fine; a scene with hundreds of thousands of dynamic elements and heavy shaders might not be. That's a per-lab budgeting question, which is exactly why we're inventorying the heaviest planned scene in `LAB_IDEAS.md` before committing.

**Key consequence:** even the "native app" options below only reach a Chromebook by *exporting to the web* (WebGL/WebAssembly). There is no path to Chromebook that skips the browser rendering layer. So the real questions are (A) what we author scenes *in*, and (B) whether we also ship native desktop installers wrapping the same build.

## The candidate stacks

All of these put a web/WebGL build on Chromebook; they differ in authoring ergonomics and how the desktop targets are packaged.

### A. Web-first, hand-authored 3D — *Three.js / Babylon.js (+ a UI framework)*
Write the app as a web app; render 3D with Three.js or Babylon.js. Ship it as an installable **PWA** (works offline once loaded) and, if we want real desktop installers, wrap the *same* build in **Tauri** (lightweight, Rust-backed) or **Electron** (heavier, Chromium-bundled). One codebase → all four platforms.

- **Strengths:** one codebase; guaranteed Chromebook support; full control over UI/visual identity; huge ecosystem and docs; cheapest "many small demos" path once a shared shell exists; Babylon.js in particular has strong built-in camera rigs, gizmos, and an inspector.
- **Weaknesses:** complex *scenes* are authored in code rather than a visual editor — fine for parametric/scientific scenes, more tedious for hand-placed art-heavy environments; you assemble your own structure (though templates fix this).
- **Best when:** most demos are parametric/data-driven (networks, plots, procedural spaces) rather than hand-built 3D worlds.

### B. Game engine with web export — *Godot (open source) or Unity*
Author scenes in a full visual editor with a scene graph, physics, and built-in camera nodes; export an **HTML5/WebAssembly** build for Chromebook and native builds for desktop.

- **Strengths:** best authoring ergonomics for rich, hand-placed 3D worlds; visual editor; physics/animation batteries included; Godot is open source (license-compatible) and lightweight.
- **Weaknesses:** the **web export is the weak link for our binding platform** — larger downloads, slower cold start, occasional browser/threading quirks, and heavier load on low-end Chromebooks than a lean Three.js page. UI-heavy lab "handout" chrome and 2D plotting are more awkward than in a web-native stack. Unity is proprietary with licensing strings; Unreal's web export is effectively dead (excluded).
- **Best when:** several labs are genuinely 3D-world-heavy (walkable environments, physics) such that a visual editor pays for itself despite the web-export cost.

### C. Hybrid — web-first shell, engine-exported scenes embedded where needed
Default to stack A for the app shell, UI, 2D, and light 3D; embed a Godot/Unity web export only for the few labs that truly need a full engine. Highest ceiling, highest complexity (two toolchains). Only worth it if a small number of labs are far heavier than the rest.

## The questions the labs answered

These came from the labs, which is why `LAB_IDEAS.md` came first. All are now resolved:

1. **How many labs are truly 3D-world-heavy vs. parametric/2D?** → Neither extreme. The bulk is a single **evolving-creature sim** (creature on a plane / fish in a volume) — 3D but "objects in a navigable space," not an art-heavy world. Plus satellite scenes (M3 neuron, M6 brain flythrough, M12–14 abstract) that are mostly 2D/UI or light 3D. **No lab justifies a game engine's world editor.**
2. **The heaviest scene's budget?** → Tiny in graphics terms. The real ceiling is **neural-network complexity**, not agent count: one focal creature has a visualizable network; other on-screen agents are hard-coded "NPCs." Only the social-cognition week (M11, primates + game theory) needs multiple full networks, and ~two suffices. A TS neural layer handles this comfortably; escape hatches exist if a net ever grows (typed arrays, tensorflow.js/WebGL).
3. **Native installers, or PWA enough?** → **PWA is enough for now.** Open-a-URL is the lowest-friction path for students and satisfies the "no setup" requirement; a PWA also installs and runs offline once cached, covering in-class demos. Tauri wrappers are deferred, not rejected.
4. **Offline strength?** → PWA offline caching covers the realistic classroom case. Revisit only if a genuinely air-gapped hall appears.

## Decision: web-first PWA + Three.js / react-three-fiber

The pick is **Stack A**, specialized to **Three.js + react-three-fiber (r3f)** over Babylon.js:

- **Chromebook support is guaranteed, not "exported to"** — the binding constraint, satisfied by construction.
- **r3f unifies the 3D scene and the inspection UI in one React tree.** The recurring need — click a creature → show its wiring in a side panel, live voltage/decision-boundary plots — is exactly what React/DOM does well and what an engine does awkwardly. Plots and control panels are trivial in React.
- **The simulation and neural logic are plain TypeScript modules** driven by the r3f render loop (`useFrame`), cleanly separated from rendering — easy to test and to reason about.
- **One engine, parameterized by evolutionary stage** (see `APP_DESIGN.md`): the same creature/sensor/nervous-system framework is configured per module (M1 vehicle → M4 bilaterian → M5/M7 fish → possibly M11 primate), with satellite scenes reusing the shared shell.
- **Approachable for one maintainer.** React + Three.js is the most widely documented web-3D combination; r3f has a large component ecosystem (`@react-three/drei` for camera controls, helpers).

**Babylon.js** was the main alternative — more batteries-included (physics, scene inspector, camera rigs). Rejected because the app is mostly kinematic creatures + heavy custom UI + custom neural math, where Babylon's engine features add little and its UI story is weaker than React/DOM. Revisit only if a future lab needs serious rigid-body physics.

**Electron** and native **game engines (Godot/Unity)** were rejected earlier: Electron is a heavy wrapper with no Chromebook path of its own, and any native engine reaches Chromebook only via a heavier WebAssembly export while adding little for our custom-math/custom-UI workload.

## Deferred / revisit triggers

- **Add Tauri desktop installers** if we want signed native apps or true offline distribution beyond PWA caching.
- **Reconsider Babylon or a physics library** (e.g., Rapier via r3f) if a lab needs real rigid-body/soft-body physics.
- **Move neural compute off the main thread / onto WebGL** (Web Worker, tensorflow.js) only if a focal network ever gets large enough to drop frames.

## Decision log

- **2026-07-13** — Chose web-first **PWA + Three.js/react-three-fiber**, TypeScript sim/neural layer, React/DOM inspection UI; Tauri deferred. Basis: Chromebook is the binding constraint (web rendering mandatory either way); the labs are one evolving-creature engine + satellites, not world-heavy; peak load is ~1–2 focal neural networks, so no perf pressure. Babylon.js, Electron, and native game engines considered and rejected (see above).
