import { loadClip, loadJson, type Clip } from '../../../sim/language/audio/clips'
import { spectrogram, type Spectrogram } from '../../../sim/language/audio/spectrogram'
import { SYLLABLES, type Stream, type Syllable } from '../../../sim/language/stream/language'

/**
 * Part 2's shipped files (spec §6): the twelve stream syllables, plain and
 * lengthened, each exactly one syllable long, from which the student's
 * minute is assembled in the seeded word order; and the real-speech sample
 * for Step 4. A minute is 216 syllables; the assembled sound is one buffer,
 * and the strip under the cursor is drawn from the twelve syllables' own
 * spectrograms, since every token of a syllable is the same sound.
 */
export interface StreamJson {
  words: string[]
  syllables: string[]
  syllablesPerMinute: number
  syllableS: number
  lengthenS: number
  f0: number
  plain: Record<string, { file: string; durationS: number }>
  long: Record<string, { file: string; durationS: number }>
  probe: { minutes: number; syllables: number; difference: { duration: number; peak: number; pitch: number }; tolerance: { durationS: number; peakDb: number; pitchHz: number }; withinTolerance: boolean }
}

export interface RealSpeech {
  citation: string
  corpora: string[]
  transcriptsRead: number
  transcriptsUsed: number
  ageCeilingMonths: number
  utterancesUsed: number
  utterancesDropped: number
  syllableTokens: number
  syllableTypes: number
  syllabification: string
  histogram: { bins: number[]; inside: number[]; across: number[]; insideN: number; acrossN: number; insideMean: number; acrossMean: number }
  dipsLearner: { cuts: number; cutsOnBoundary: number; precision: number; boundaries: number; boundariesFound: number; recall: number }
  madeUpLanguage: { hist: { inside: number[]; across: number[] }; shares: { cuts: number; cutsOnBoundary: number; precision: number; boundaries: number; boundariesFound: number; recall: number } }
  utterances: { words: string[]; syllables: string[]; stress: number[]; wordOf: number[]; tp: number[] }[]
}

export const loadStreamJson = () => loadJson<StreamJson>('stream.json')
export const loadRealSpeech = () => loadJson<RealSpeech>('realspeech.json')
export const streamClip = (file: string, ctx: AudioContext | null) => loadClip(`audio/stream/${file}`, ctx)

export interface Assembled {
  samples: Float32Array
  /** Each syllable's start and end, seconds. */
  marks: { startS: number; endS: number }[]
  durationS: number
}

/** The student's minute: the first `n` syllables of the stream, each the shipped clip; `long` uses the lengthened clip for a word's third syllable. */
export function assemble(stream: Stream, n: number, clips: Map<string, Clip>, long: boolean): Assembled {
  const parts: Float32Array[] = []
  const marks: { startS: number; endS: number }[] = []
  let total = 0
  for (let i = 0; i < Math.min(n, stream.syllables.length); i++) {
    const s = stream.syllables[i]
    const c = clips.get(long && stream.position[i] === 2 ? `long:${s}` : `plain:${s}`)
    if (!c) throw new Error(`no clip for ${s}`)
    parts.push(c.samples)
    total += c.samples.length
  }
  const out = new Float32Array(total)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    marks.push({ startS: pos / 16000, endS: (pos + p.length) / 16000 })
    pos += p.length
  }
  return { samples: out, marks, durationS: total / 16000 }
}

/** The spectrogram of each syllable clip, wide view, once. */
export function syllableSpectrograms(clips: Map<string, Clip>, long: boolean): Map<Syllable, Spectrogram> {
  const out = new Map<Syllable, Spectrogram>()
  for (const s of SYLLABLES) {
    const c = clips.get(`${long ? 'long' : 'plain'}:${s}`)
    if (c) out.set(s, spectrogram(c.samples, c.sampleRate, 'wide', 0.002, 5000))
  }
  return out
}
