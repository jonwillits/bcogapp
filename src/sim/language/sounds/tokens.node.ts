import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseWav } from '../audio/wav'
import { classifierPatch } from '../audio/spectrogram'
import type { Token, Label } from './classifier'

/**
 * The shipped training tokens, loaded in Node for the tests and the
 * probes, with each token's patch computed by the same code the browser
 * uses (`classifierPatch`). The browser's loader is `audio/clips.ts`.
 */
const PUB = join(__dirname, '..', '..', '..', '..', 'public', 'm13')

export interface TokenIndex {
  voice: number
  heldOut: boolean
  consonant: Label
  vowel: string
  shift: number
  start: number
  length: number
  burstS: number
  pitchHz: number
}

export interface Shipped {
  tokens: Token[]
  heldOutVoices: number[]
  sampleRate: number
}

export function loadShippedTokens(): Shipped {
  const tts = JSON.parse(readFileSync(join(PUB, 'tts.json'), 'utf-8')) as { tokens: { heldOutVoices: number[]; tokens: TokenIndex[] } }
  const b = readFileSync(join(PUB, 'audio', 'tokens', 'tokens.wav'))
  const wav = parseWav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  const tokens: Token[] = tts.tokens.tokens.map((t) => ({
    patch: classifierPatch(wav.samples.subarray(t.start, t.start + t.length), wav.sampleRate, t.burstS),
    label: t.consonant,
    voice: t.voice,
    shift: t.shift,
    vowel: t.vowel,
  }))
  return { tokens, heldOutVoices: tts.tokens.heldOutVoices, sampleRate: wav.sampleRate }
}

/** The 14 continuum steps as patches, for run 3. */
export function loadContinuumPatches(): Float32Array[] {
  const cont = JSON.parse(readFileSync(join(PUB, 'continuum.json'), 'utf-8')) as { steps: { file: string }[] }
  return cont.steps.map((s) => {
    const b = readFileSync(join(PUB, 'audio', 'continuum', s.file))
    const w = parseWav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    // The continuum's release is at the start of the file. The patch starts 20 ms before the burst, so 40 ms of silence is put before the file, as the shipped tokens carry 40 ms before theirs; the browser's loader does the same.
    const pad = Math.round(0.04 * w.sampleRate)
    const padded = new Float32Array(pad + w.samples.length)
    padded.set(w.samples, pad)
    return classifierPatch(padded, w.sampleRate, pad / w.sampleRate)
  })
}
