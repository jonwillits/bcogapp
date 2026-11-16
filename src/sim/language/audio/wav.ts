/**
 * A reader for the lab's own WAV files: 16-bit PCM, mono, as the offline
 * scripts write them (`training/m13/`). The browser decodes shipped sounds
 * with `decodeAudioData` (`clips.ts`); this reader is for the tests and the
 * probes, which run in Node, and for the classifier's agreement test, so
 * that what the network receives is computed from the same samples in
 * both places.
 */
export interface Wav {
  sampleRate: number
  samples: Float32Array
}

export function parseWav(buf: ArrayBuffer): Wav {
  const v = new DataView(buf)
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file')
  let o = 12
  let sampleRate = 0
  let channels = 1
  let bits = 16
  let data: Float32Array | null = null
  while (o + 8 <= v.byteLength) {
    const id = tag(o)
    const size = v.getUint32(o + 4, true)
    const body = o + 8
    if (id === 'fmt ') {
      const format = v.getUint16(body, true)
      channels = v.getUint16(body + 2, true)
      sampleRate = v.getUint32(body + 4, true)
      bits = v.getUint16(body + 14, true)
      if (format !== 1 || bits !== 16) throw new Error(`unsupported WAV: format ${format}, ${bits} bits`)
    } else if (id === 'data') {
      const n = Math.floor(size / 2 / channels)
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        // Mono, or the first channel of several.
        out[i] = v.getInt16(body + i * 2 * channels, true) / 32768
      }
      data = out
    }
    o = body + size + (size % 2)
  }
  if (!data || !sampleRate) throw new Error('WAV without data')
  return { sampleRate, samples: data }
}
