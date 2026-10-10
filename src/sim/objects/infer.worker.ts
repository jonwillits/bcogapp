/**
 * The photo networks run here, off the main thread, so a sequence of
 * inferences never blocks a click (spec §11: no main-thread block over
 * about 300 ms during a larger test). The worker loads a model on first
 * use and holds it; the main thread never has the photo weights.
 */
import { getModel, type ModelName } from './models'
import { classify, penultimate } from './net'

export interface InferRequest {
  id: number
  model: ModelName
  base: string
  what: 'classify' | 'penultimate'
  image: Float32Array
}
export interface InferResponse {
  id: number
  top?: number
  probs?: Float32Array
  features?: Float32Array
  error?: string
}

self.onmessage = async (e: MessageEvent<InferRequest>) => {
  const req = e.data
  try {
    const model = await getModel(req.model, req.base)
    if (req.what === 'classify') {
      const out = classify(model, req.image)
      const res: InferResponse = { id: req.id, top: out.top, probs: out.probs }
      ;(self as unknown as Worker).postMessage(res, [out.probs.buffer])
    } else {
      const features = penultimate(model, req.image)
      const res: InferResponse = { id: req.id, features }
      ;(self as unknown as Worker).postMessage(res, [features.buffer])
    }
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id: req.id, error: String(err) } satisfies InferResponse)
  }
}
