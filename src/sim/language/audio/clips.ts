import { parseWav } from './wav'

/**
 * The shipped sounds, loaded and decoded before a step begins (spec §3):
 * one fetch per file from the lab's own folder, decoded with the lab's own
 * WAV reader in the browser and in the tests alike, and kept as float
 * samples at 16 kHz. The browser's `decodeAudioData` is not used, because
 * it resamples to the audio context's rate (44.1 or 48 kHz), and the
 * network's input would then differ from the probe's; the buffer for
 * playback is built from the 16 kHz samples and the audio hardware
 * resamples on output. Nothing is uploaded, and nothing is recorded
 * (`privacy.test.ts`).
 */
export interface Clip {
  sampleRate: number
  samples: Float32Array
  /** The decoded buffer for playback, where an AudioContext exists. */
  buffer: AudioBuffer | null
}

export function base(): string {
  const b = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${b.endsWith('/') ? b : b + '/'}m13/`
}

const cache = new Map<string, Promise<Clip>>()

export async function loadClip(path: string, ctx?: AudioContext | null): Promise<Clip> {
  const url = base() + path
  const key = url + (ctx ? '#ctx' : '')
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`)
        const bytes = await res.arrayBuffer()
        const w = parseWav(bytes)
        return { sampleRate: w.sampleRate, samples: w.samples, buffer: ctx ? bufferFrom(ctx, w.samples, w.sampleRate) : null }
      })(),
    )
  }
  return cache.get(key)!
}

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(base() + path)
  if (!res.ok) throw new Error(`could not load ${path}: ${res.status}`)
  return (await res.json()) as T
}

/** A buffer built from samples, for sounds assembled from clips (the stream). */
export function bufferFrom(ctx: AudioContext, samples: Float32Array, sampleRate: number): AudioBuffer {
  const b = ctx.createBuffer(1, samples.length, sampleRate)
  b.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  return b
}
