import { loadClip, loadJson, type Clip } from '../../../sim/language/audio/clips'
import { classifierPatch } from '../../../sim/language/audio/spectrogram'
import type { Token } from '../../../sim/language/sounds/classifier'

/**
 * Part 1's shipped files and how they are loaded: the JSON descriptions
 * under public/m13 and the sounds under public/m13/audio, decoded before a
 * step begins (spec §3). Nothing is synthesized in the browser.
 */
export interface VowelSound {
  file: string
  f0: number
  formants: number[]
  bandwidths: number[]
  duration_s: number
  tractScale?: number
}
export interface Vowels {
  vowels: Record<string, number[]>
  bandwidths: number[]
  tractScale: number
  sounds: Record<string, VowelSound>
}
export interface ContinuumStep {
  step: number
  file: string
  f2Onset: number
  f1Onset: number
  f1Steady: number
  f2Steady: number
  f0: number
  durationS: number
  transitionS: number
  bandwidths: number[]
}
export interface Continuum {
  source: string
  steps: ContinuumStep[]
}
export interface SixSyllable {
  file: string
  phonemes: string
  voice: number
  durationS: number
  burstS: number
  voicingS: number
  tracks: { timesS: number[]; f1: (number | null)[]; f2: (number | null)[]; f3: (number | null)[] }
}
export interface TokenIndex {
  voice: number
  heldOut: boolean
  consonant: 'b' | 'd' | 'g'
  vowel: string
  shift: number
  start: number
  length: number
  burstS: number
  pitchHz: number
}
export interface Tts {
  six: Record<string, SixSyllable>
  vot: Record<string, { file: string; burstS: number; voicingS: number; votMs: number; durationS: number }>
  words: { word: string; set: number; file: string; durationS: number }[]
  tokens: { voices: number; heldOutVoices: number[]; shiftSemitones: number; consonants: string[]; vowels: string[]; count: number; tokens: TokenIndex[]; trim: { beforeBurstS: number; afterBurstS: number } }
}

export const SIX_ORDER = ['bee', 'bah', 'boo', 'dee', 'dah', 'doo'] as const
export type Six = (typeof SIX_ORDER)[number]

export const loadVowels = () => loadJson<Vowels>('vowels.json')
export const loadContinuum = () => loadJson<Continuum>('continuum.json')
export const loadTts = () => loadJson<Tts>('tts.json')

export const vowelClip = (file: string, ctx: AudioContext | null) => loadClip(`audio/vowels/${file}`, ctx)
export const continuumClip = (file: string, ctx: AudioContext | null) => loadClip(`audio/continuum/${file}`, ctx)
export const syllableClip = (file: string, ctx: AudioContext | null) => loadClip(`audio/syllables/${file}`, ctx)
export const votClip = (file: string, ctx: AudioContext | null) => loadClip(`audio/vot/${file}`, ctx)
export const tokensClip = (ctx: AudioContext | null) => loadClip('audio/tokens/tokens.wav', ctx)

/** The training tokens' patches from the one shipped file, computed by the spectrogram's own code; sliced so that the main thread is never held long. */
export async function tokenPatches(clip: Clip, index: TokenIndex[], onProgress?: (done: number) => void): Promise<Token[]> {
  const out: Token[] = []
  for (let i = 0; i < index.length; i++) {
    const t = index[i]
    out.push({ patch: classifierPatch(clip.samples.subarray(t.start, t.start + t.length), clip.sampleRate, t.burstS), label: t.consonant, voice: t.voice, shift: t.shift, vowel: t.vowel })
    if (i % 40 === 39) {
      onProgress?.(i + 1)
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  return out
}

/** The continuum step's patch: 40 ms of silence before the file, since its release is at the start, as `tokens.node.ts` does for the probe. */
export function continuumPatch(clip: Clip): Float32Array {
  const pad = Math.round(0.04 * clip.sampleRate)
  const padded = new Float32Array(pad + clip.samples.length)
  padded.set(clip.samples, pad)
  return classifierPatch(padded, clip.sampleRate, pad / clip.sampleRate)
}

/** One token's samples, for playing or drawing it. */
export function tokenSamples(clip: Clip, t: TokenIndex): Float32Array {
  return clip.samples.subarray(t.start, t.start + t.length)
}
