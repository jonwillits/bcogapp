import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page, and storage is one key (spec §12, item 9): the
 * browser's storage is named in one file, the only key is `bcogapp.m10.v1`,
 * and nothing in the layer fetches, posts, opens a socket or evaluates text.
 */
const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = Object.entries(files).filter(([p]) => !p.includes('.test.'))

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('one storage key, in one file', () => {
  it('finds the sources', () => {
    expect(production.some(([p]) => p.endsWith('/storage.ts'))).toBe(true)
    expect(production.length).toBeGreaterThanOrEqual(4)
  })

  it('localStorage, sessionStorage and indexedDB appear only in storage.ts', () => {
    for (const [path, src] of production) {
      const code = stripComments(src)
      if (path.endsWith('/storage.ts')) {
        expect(code).toMatch(/localStorage/)
        expect(code).not.toMatch(/sessionStorage|indexedDB/)
      } else {
        expect(code, path).not.toMatch(/localStorage|sessionStorage|indexedDB/)
      }
    }
  })

  it('the only key is bcogapp.m10.v1', () => {
    for (const [path, src] of production) {
      // The export file's kind names the lab too; it is a label inside a file, not a storage key.
      const keys = [...stripComments(src).matchAll(/['"`](bcogapp\.[^'"`]*)['"`]/g)].map((m) => m[1]).filter((k) => k !== 'bcogapp.m10 saved results')
      for (const k of keys) expect(k, path).toBe('bcogapp.m10.v1')
      if (!path.endsWith('/storage.ts')) expect(keys, path).toEqual([])
    }
    const storage = production.find(([p]) => p.endsWith('/storage.ts'))![1]
    expect(storage).toMatch(/STORAGE_KEY = 'bcogapp\.m10\.v1'/)
    // Every storage call names the one key and never builds another.
    for (const m of stripComments(storage).matchAll(/localStorage\.\w+\(([^)]*)\)/g)) expect(m[1], m[0]).toMatch(/^STORAGE_KEY(,|$)/)
  })

  it('nothing fetches, posts, opens a socket, beacons or evaluates text', () => {
    for (const [path, src] of production) {
      expect(src, path).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|\beval\(|new Function|EventSource|navigator\.share/)
    }
  })
})
