import { base } from '../../audio/clips'
import { loadSeqModel, type SeqDesc, type SeqModel } from './seqNet'

/**
 * The browser's loader for Part 4's shipped models: one fetch for each
 * model's description and one for each snapshot's weights, from the lab's
 * own folder, cached. Nothing is uploaded (`privacy.test.ts`).
 */
const descs = new Map<string, Promise<SeqDesc>>()
const models = new Map<string, Promise<SeqModel>>()

export function loadDesc(kind: 'transformer' | 'srn'): Promise<SeqDesc> {
  if (!descs.has(kind))
    descs.set(
      kind,
      fetch(`${base()}models/${kind}.json`).then((r) => {
        if (!r.ok) throw new Error(`could not load ${kind}.json`)
        return r.json() as Promise<SeqDesc>
      }),
    )
  return descs.get(kind)!
}

export async function loadSnapshot(kind: 'transformer' | 'srn', updates?: number): Promise<SeqModel> {
  const desc = await loadDesc(kind)
  const snap = updates === undefined ? desc.snapshots[desc.snapshots.length - 1] : desc.snapshots.find((s) => s.updates === updates)
  if (!snap) throw new Error(`no snapshot at ${updates}`)
  const key = `${kind}:${snap.updates}`
  if (!models.has(key))
    models.set(
      key,
      fetch(`${base()}models/${snap.weightsFile}`).then(async (r) => {
        if (!r.ok) throw new Error(`could not load ${snap.weightsFile}`)
        return loadSeqModel(desc, snap.updates, await r.arrayBuffer())
      }),
    )
  return models.get(key)!
}
