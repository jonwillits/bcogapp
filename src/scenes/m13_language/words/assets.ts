import { loadClip, loadJson, type Clip } from '../../../sim/language/audio/clips'
import { base } from '../../../sim/language/audio/clips'

/**
 * Part 3's shipped files (spec §7.1): 24 made-up words in one voice and 24
 * objects as SVG files, 12 of each in the first set and 12 in the reserve.
 * The written form of a word is never shown before the reveal; the object
 * files are nameless shapes.
 */
export interface WordFile {
  word: string
  set: number
  file: string
  durationS: number
}
export interface ObjectFile {
  id: string
  set: number
  fill: string
  pattern: string
}

export async function loadWordFiles(): Promise<WordFile[]> {
  const tts = await loadJson<{ words: WordFile[] }>('tts.json')
  return tts.words
}
export const loadObjects = () => loadJson<ObjectFile[]>('objects/objects.json')
export const wordClip = (file: string, ctx: AudioContext | null): Promise<Clip> => loadClip(`audio/words/${file}`, ctx)
export const objectUrl = (id: string) => `${base()}objects/${id}.svg`
