import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page (spec §11, item 8): no camera, no microphone, no
 * upload, no network request that carries anything the student did, and
 * storage only through the shared layer under Lab 13's one key. The only
 * fetches anywhere in the lab read its own shipped sound and model files.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/language/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(scene), ...Object.entries(sim)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('nothing leaves the page', () => {
  it('no POST, no XMLHttpRequest, no WebSocket, no beacon, no form submission; fetch only in the loaders of shipped files', () => {
    for (const [path, src] of all) {
      expect(src, path).not.toMatch(/method:\s*['"]POST|XMLHttpRequest|WebSocket|sendBeacon|<form|EventSource/)
      if (!/\/(audio\/clips|predictors\/runtime\/load)\.ts$/.test(path)) expect(src, path).not.toMatch(/\bfetch\(/)
    }
  })
  it('no camera, no microphone, no storage outside the shared layer', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/mediaDevices|getUserMedia|localStorage|sessionStorage|indexedDB|navigator\.share|MediaRecorder|AnalyserNode|createMediaStreamSource/)
  })
  it('the only file input is Load my results, in Lab 10’s shared control', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/type="file"/)
  })
  it('no browser dialog: no alert, confirm or prompt', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\balert\(|window\.confirm|\bconfirm\(|window\.prompt|\bprompt\(/)
  })
  it('no Math.random in the sim or the scene: one seeded stream decides everything (spec §14)', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/Math\.random/)
  })
  it('no image of a person: no photograph file anywhere in the lab, and no drawing names a face, mouth, throat or vocal tract', () => {
    for (const [path, src] of all) {
      expect(src, path).not.toMatch(/\.(jpg|jpeg|webp)['"]/)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, path).not.toMatch(/drawFace|drawMouth|<Face|<Mouth|vocalTractDrawing/)
    }
  })
})
