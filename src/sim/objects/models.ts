/**
 * Loading the shipped models in the browser. Each model is two files under
 * `m08/models/`, fetched the first time a part needs it and never again.
 * Nothing loads before its part opens (spec §3.5).
 */
import { loadModel, type Model, type ModelDesc } from './net'

export type ModelName = 'drawing' | 'drawing_b' | 'photo_standard' | 'photo_noise' | 'photo_blur'

export const MODEL_TITLE: Record<ModelName, string> = {
  drawing: 'the drawing network',
  drawing_b: 'the drawing network, Version B',
  photo_standard: 'Standard',
  photo_noise: 'Trained on noise A',
  photo_blur: 'Trained on blurred and sharp',
}

export const PHOTO_NETS: ModelName[] = ['photo_standard', 'photo_noise', 'photo_blur']

const cache = new Map<ModelName, Promise<Model>>()

export function modelsBase(): string {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${base}m08/`
}

export function getModel(name: ModelName, base = modelsBase()): Promise<Model> {
  let p = cache.get(name)
  if (!p) {
    p = (async () => {
      const desc = (await (await fetch(`${base}models/${name}.json`)).json()) as ModelDesc
      const bin = await (await fetch(`${base}models/${desc.weightsFile}`)).arrayBuffer()
      return loadModel(desc, bin)
    })()
    cache.set(name, p)
  }
  return p
}
