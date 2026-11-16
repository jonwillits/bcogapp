import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page, and storage is one key (spec §11, item 8): the
 * only key named anywhere in Lab 13's sim or scene is `bcogapp.m13.v1`, in
 * one file; the browser's storage is touched only by the shared layer; and
 * nothing in either directory fetches, posts, opens a socket, beacons,
 * opens a microphone or a camera, or evaluates text.
 */
const sim = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const scene = import.meta.glob('../../../scenes/m13_language/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const shared = import.meta.glob('../../progress/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = (files: Record<string, string>) => Object.entries(files).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('one storage key, named once', () => {
  it('finds the sources', () => {
    expect(production(sim).some(([p]) => p === './storage.ts')).toBe(true)
    expect(production(shared).some(([p]) => p.endsWith('/storage.ts'))).toBe(true)
  })

  it('localStorage, sessionStorage and indexedDB appear nowhere in Lab 13; the shared layer names localStorage in its storage.ts only', () => {
    for (const [path, src] of [...production(sim), ...production(scene)]) expect(stripComments(src), path).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    for (const [path, src] of production(shared)) {
      if (path.endsWith('/storage.ts')) expect(stripComments(src)).toMatch(/localStorage/)
      else expect(stripComments(src), path).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    }
  })

  it('the only key is bcogapp.m13.v1', () => {
    for (const [path, src] of [...production(sim), ...production(scene)]) {
      const keys = [...stripComments(src).matchAll(/['"`](bcogapp\.[^'"`]*)['"`]/g)].map((m) => m[1]).filter((k) => k !== 'bcogapp.m13 saved results')
      for (const k of keys) expect(k, path).toBe('bcogapp.m13.v1')
      if (path !== './storage.ts') expect(keys, path).toEqual([])
    }
    const storage = production(sim).find(([p]) => p === './storage.ts')![1]
    expect(storage).toMatch(/STORAGE_KEY = 'bcogapp\.m13\.v1'/)
    expect(storage).toMatch(/browserStorage\(STORAGE_KEY\)/)
  })

  it('nothing fetches, posts, opens a socket, beacons, opens a microphone or camera, or evaluates text', () => {
    for (const [path, src] of [...production(sim), ...production(scene), ...production(shared)]) {
      expect(src, path).not.toMatch(/XMLHttpRequest|WebSocket|sendBeacon|\beval\(|new Function|EventSource|navigator\.share|getUserMedia|mediaDevices|navigator\.geolocation/)
      // The one fetch allowed anywhere in the lab reads the lab's own shipped sound and model files, in the audio and runtime loaders.
      if (!/\/(audio\/clips|predictors\/runtime\/load)\.ts$/.test(path)) expect(src, path).not.toMatch(/\bfetch\(/)
    }
  })
})
