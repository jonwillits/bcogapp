import { inflateSync } from 'node:zlib'

/**
 * Decode an 8-bit grayscale PNG (the only kind this lab ships) to a
 * Float32Array in [0, 1], for tests and probes in Node. The browser decodes
 * the same files losslessly, so the pixels are the same on both sides.
 */
export function decodeGrayPng(buf: Buffer): { width: number; height: number; data: Float32Array } {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat: Buffer[] = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8 || colorType !== 0) throw new Error(`expected 8-bit grayscale, got depth ${bitDepth} type ${colorType}`)
  const raw = inflateSync(Buffer.concat(idat))
  const out = new Float32Array(width * height)
  const bpp = 1
  const stride = width * bpp
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      switch (filter) {
        case 0: break
        case 1: v = (v + a) & 0xff; break
        case 2: v = (v + b) & 0xff; break
        case 3: v = (v + Math.floor((a + b) / 2)) & 0xff; break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
          break
        }
        default: throw new Error(`filter ${filter}`)
      }
      line[x] = v
    }
    for (let x = 0; x < width; x++) out[y * width + x] = line[x] / 255
    prev = line
  }
  return { width, height, data: out }
}
