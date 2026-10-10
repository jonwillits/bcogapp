import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadModel, type ModelDesc } from './net'

/** Load a shipped model from `public/m08/models/` in Node, for tests and probes. The browser fetches the same two files. */
export function loadShippedModel(name: string) {
  const dir = join(__dirname, '..', '..', '..', 'public', 'm08', 'models')
  const desc = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf-8')) as ModelDesc
  const bin = readFileSync(join(dir, desc.weightsFile))
  return loadModel(desc, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
}
