/**
 * The main thread's handle on the inference worker: a promise per image.
 * Where there is no `Worker` (tests, server rendering) the same model runs
 * on this thread, so the results are the same either way.
 */
import { getModel, modelsBase, type ModelName } from './models'
import { classify, penultimate } from './net'
import type { InferRequest, InferResponse } from './infer.worker'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: InferResponse) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    worker = new Worker(new URL('./infer.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<InferResponse>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.error) p.reject(new Error(e.data.error))
      else p.resolve(e.data)
    }
  }
  return worker
}

function send(req: Omit<InferRequest, 'id' | 'base'>): Promise<InferResponse> {
  const w = getWorker()
  if (!w) {
    return getModel(req.model).then((m) => {
      if (req.what === 'classify') { const o = classify(m, req.image); return { id: 0, top: o.top, probs: o.probs } }
      return { id: 0, features: penultimate(m, req.image) }
    })
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const image = req.image.slice()
    const full: InferRequest = { ...req, id, base: modelsBase(), image }
    w.postMessage(full, [image.buffer])
  })
}

export async function classifyWith(model: ModelName, image: Float32Array): Promise<{ top: number; probs: Float32Array }> {
  const r = await send({ model, what: 'classify', image })
  return { top: r.top!, probs: r.probs! }
}

export async function featuresWith(model: ModelName, image: Float32Array): Promise<Float32Array> {
  const r = await send({ model, what: 'penultimate', image })
  return r.features!
}

/** Ask the worker to load a model now, so a part's first inference does not wait for the download. */
export function warmUp(model: ModelName): void {
  const w = getWorker()
  if (!w) return
  const image = new Float32Array(160 * 160)
  const id = nextId++
  pending.set(id, { resolve: () => {}, reject: () => {} })
  w.postMessage({ id, model, base: modelsBase(), what: 'classify', image } satisfies InferRequest, [image.buffer])
}
