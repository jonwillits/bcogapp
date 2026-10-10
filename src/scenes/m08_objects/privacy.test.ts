import { describe, it, expect } from 'vitest'

/**
 * No camera, no microphone, no file upload, and no request that carries
 * anything the student made (spec §9.3, §11): the scene and the objects
 * layer only ever fetch the lab's own files, and never store a drawing or
 * a response beyond the open page.
 */
const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/objects/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(scene), ...Object.entries(sim)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('nothing leaves the page', () => {
  it('no POST, no XMLHttpRequest, no WebSocket, no beacon, no form submission', () => {
    for (const [path, src] of all) {
      expect(src, path).not.toMatch(/method:\s*['"]POST|XMLHttpRequest|WebSocket|sendBeacon|<form|EventSource/)
    }
  })
  it('every fetch is of the lab’s own files under its base', () => {
    for (const [path, src] of all) {
      for (const m of src.matchAll(/fetch\((.{0,60})/g)) expect(m[1], `${path}: ${m[0]}`).toMatch(/modelsBase\(\)|\$\{base\}|lab\.rawUrl/)
    }
  })
  it('no camera, no microphone, no file input, no storage', () => {
    for (const [path, src] of all) {
      expect(src, path).not.toMatch(/mediaDevices|getUserMedia|type="file"|type: 'file'|localStorage|sessionStorage|indexedDB|navigator\.share/)
    }
  })
})
