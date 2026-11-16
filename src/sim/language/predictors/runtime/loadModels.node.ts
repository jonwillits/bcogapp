import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadSeqModel, type SeqDesc, type SeqModel } from './seqNet'

/** The shipped models, loaded in Node for the tests and the probes. */
const MODELS = join(__dirname, '..', '..', '..', '..', '..', 'public', 'm13', 'models')

export function readDesc(kind: 'transformer' | 'srn'): SeqDesc {
  return JSON.parse(readFileSync(join(MODELS, `${kind}.json`), 'utf-8')) as SeqDesc
}

export function loadShipped(kind: 'transformer' | 'srn', updates?: number): SeqModel {
  const desc = readDesc(kind)
  const snap = updates === undefined ? desc.snapshots[desc.snapshots.length - 1] : desc.snapshots.find((s) => s.updates === updates)!
  const b = readFileSync(join(MODELS, snap.weightsFile))
  return loadSeqModel(desc, snap.updates, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
