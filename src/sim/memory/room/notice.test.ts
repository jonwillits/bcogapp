import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every 3D model a student can see in Part 3's room is credited and
 * licensed (spec §7.1, §12 item 10): every shipped `.glb` and texture is in
 * the folder's NOTICE and in `manifest.json`; every manifest entry names
 * its source page and a CC0 licence; the whole folder fits its size budget;
 * and the root `NOTICE.md` points at the folder, as it does for Lab 6's
 * photographs and Lab 8's images.
 */
const ROOM = join(__dirname, '..', '..', '..', '..', 'public', 'm10', 'room')
const walk = (dir: string, out: string[] = [], prefix = ''): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), out, `${prefix}${e.name}/`)
    else if (/\.(glb|gltf|png|jpe?g|webp|bin)$/i.test(e.name)) out.push(`${prefix}${e.name}`)
  }
  return out
}
/** The shipped folder must stay small: the models are low-poly kit pieces, not scans; two Poly Haven scans are the exception, at under 2 MB each. */
const BUDGET_BYTES = 6 * 1024 * 1024

interface Manifest {
  packs: { name: string; folder: string; author: string; source: string; license: string }[]
  models: { id: string; name: string; role: 'furniture' | 'fitting' | 'unfitting'; file: string; model: string; pack: string; author: string; source: string; license: string; bytes: number; triangles: number }[]
  textures: { file: string; pack: string; source: string; license: string; bytes: number }[]
  totalBytes: number
}

describe('the room’s models', () => {
  const notice = readFileSync(join(ROOM, 'NOTICE'), 'utf-8')
  const manifest = JSON.parse(readFileSync(join(ROOM, 'manifest.json'), 'utf-8')) as Manifest
  const files = walk(ROOM)
  const listed = [...manifest.models.map((m) => m.file), ...manifest.textures.map((t) => t.file)]

  it('every shipped file is in the NOTICE and in the manifest, and the manifest lists nothing that is not shipped', () => {
    expect(files.length).toBeGreaterThan(20)
    for (const f of files) {
      expect(notice, f).toContain(f)
      expect(listed, f).toContain(f)
    }
    for (const f of listed) expect(files, f).toContain(f)
  })

  it('every model and texture carries its source page, its author and a CC0 licence, and its pack is credited', () => {
    for (const m of [...manifest.models, ...manifest.textures]) {
      expect(m.source, m.file).toMatch(/^https:\/\/kenney\.nl\/assets\/|^https:\/\/quaternius\.com\/|^https:\/\/polyhaven\.com\//)
      expect(m.license, m.file).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
      expect(notice).toContain(m.source)
      expect(manifest.packs.some((p) => p.name === m.pack), m.file).toBe(true)
    }
    for (const m of manifest.models) expect(m.author, m.file).toBeTruthy()
    expect(notice).toMatch(/NOT covered by the app's GNU General Public License/)
    expect(notice).toMatch(/creativecommons\.org\/publicdomain\/zero\/1\.0/)
  })

  it('ids are unique, roles are the three kinds, and every GLB that references a texture ships it beside itself', () => {
    const ids = manifest.models.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of manifest.models) {
      expect(['furniture', 'fitting', 'unfitting']).toContain(m.role)
      const b = readFileSync(join(ROOM, m.file))
      expect(b.readUInt32LE(0), m.file).toBe(0x46546c67)
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { images?: { uri?: string }[] }
      for (const img of json.images ?? []) {
        if (!img.uri) continue
        const folder = m.file.slice(0, m.file.lastIndexOf('/') + 1)
        expect(files, `${m.file} needs ${img.uri}`).toContain(folder + img.uri)
      }
    }
  })

  it('the shipped folder fits the budget and the manifest’s sizes are true', () => {
    let total = 0
    for (const f of files) total += statSync(join(ROOM, f)).size
    expect(total).toBeLessThan(BUDGET_BYTES)
    expect(total).toBe(manifest.totalBytes)
    for (const m of manifest.models) expect(statSync(join(ROOM, m.file)).size, m.file).toBe(m.bytes)
  })

  it('the root NOTICE.md names the folder', () => {
    const root = readFileSync(join(ROOM, '..', '..', '..', 'NOTICE.md'), 'utf-8')
    expect(root).toContain('public/m10/room')
  })
})
