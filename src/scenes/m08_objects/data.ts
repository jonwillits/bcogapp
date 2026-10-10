import { useEffect, useState } from 'react'
import { getModel, modelsBase, type ModelName } from '../../sim/objects/models'
import type { Model } from '../../sim/objects/net'
import type { DisplayDrawing, PhotoItem } from '../../sim/objects/trials'
import type { View } from '../../sim/objects/views'

/**
 * What the scene fetches, and when: a part's models and images load when
 * that part opens, and nothing before (spec §3.5). Each helper caches.
 */

export interface ScannedManifest {
  size: number
  views: View[]
  objects: { id: string; set: 'shoe' | 'other'; name: string; title: string; description: string; source: string; license: string }[]
  learnedViews: string[]
}
export interface PhotosManifest { size: number; categories: string[]; images: PhotoItem[] }
export interface DisplayManifest { levels: number[]; drawings: DisplayDrawing[] }
export interface MovedPair { id: string; category: string; part: number[]; dx: number; dy: number; what: string; original: [number[], number[]][]; moved: [number[], number[]][]; otherId: string }

export interface Measurements {
  networks: Record<string, { model: string; architecture: string; weights: number; testAccuracy?: number; testAccuracyClean?: number; wallClockSeconds: number; device: string; hardware: string; trainingDrawings?: number; trainingImages?: number }>
  part1: { a: ToleranceMeasure; b: ToleranceMeasure; untrained: Record<'a' | 'b', Record<string, number>> }
  part2: { erasers: { levels: number[]; largerN: number; accuracy: Record<string, number>; gap: Record<string, number>; displayN: number }; moved: { pairs: { id: string; category: string; what: string; originalLabel: string; originalP: number; movedLabel: string; movedP: number; matchMoved: number; matchOrdinary: number; labelChanged: boolean }[]; labelChanged: number; n: number } }
  part4: { testImages: number; defaults: { A: number; B: number }; nets: Record<string, { clean: number; noiseA: Record<string, number>; noiseB: Record<string, number>; atDefaults: { A: number; B: number } }>; drawings: { n: number; perCategory: number; renderedAs: string; nets: Record<string, number> } }
}
export interface ToleranceMeasure { n: number; layers: string[]; accuracyCentered: number; shift: Record<string, { match: number[]; accuracy: number }>; turn: Record<string, { match: number[]; accuracy: number }>; centered: Record<string, number> }

const jsonCache = new Map<string, Promise<unknown>>()
export function fetchJson<T>(path: string): Promise<T> {
  let p = jsonCache.get(path)
  if (!p) {
    p = fetch(`${modelsBase()}${path}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: ${r.status}`))))
    jsonCache.set(path, p)
  }
  return p as Promise<T>
}

/** A fetched JSON file, or null until it arrives; `given` short-circuits for tests. */
export function useJson<T>(path: string, given?: T): T | null {
  const [v, setV] = useState<T | null>(given ?? null)
  useEffect(() => {
    if (given) return
    let live = true
    fetchJson<T>(path).then((d) => { if (live) setV(d) }).catch(() => {})
    return () => { live = false }
  }, [path, given])
  return v
}

/** A model loaded on this thread (the drawing network; the photo networks run in the worker). */
export function useModel(name: ModelName | null, given?: Model): Model | null {
  const [m, setM] = useState<Model | null>(given ?? null)
  useEffect(() => {
    if (given || !name) return
    let live = true
    getModel(name).then((x) => { if (live) setM(x) }).catch(() => {})
    return () => { live = false }
  }, [name, given])
  return m
}

const pixelCache = new Map<string, Promise<Float32Array>>()
/** A shipped grayscale PNG as pixels in [0, 1], decoded by the browser (losslessly) through a canvas. */
export function loadGray(path: string, size: number): Promise<Float32Array> {
  let p = pixelCache.get(path)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = size; c.height = size
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, size, size)
        const d = ctx.getImageData(0, 0, size, size).data
        const out = new Float32Array(size * size)
        for (let i = 0; i < out.length; i++) out[i] = d[4 * i] / 255
        resolve(out)
      }
      img.onerror = () => reject(new Error(`could not load ${path}`))
      img.src = `${modelsBase()}${path}`
    })
    pixelCache.set(path, p)
  }
  return p
}

export const scannedPath = (object: string, view: string) => `scanned/${object}/${view}.png`
export const photoPath = (file: string) => `photos/${file}`
