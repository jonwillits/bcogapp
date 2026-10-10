import { useEffect, useRef, useState } from 'react'
import { channel, type Model, type Tensor } from '../../sim/objects/net'
import { Note } from './ui'

/**
 * The layer strip (Part 1, Step 2): the input, then each block's feature
 * maps (eight channels per block, each clickable to enlarge), then the
 * pooled maps, then the output. The maps shrink as they go, and the strip
 * prints each layer's size. Drawn with positive activity light on dark, so
 * the dark theme cannot swallow a map.
 */
const CHANNELS_SHOWN = 8

function MapCanvas({ img, size, display, title, onClick, selected }: { img: Float32Array; size: number; display: number; title: string; onClick?: () => void; selected?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let max = 0
    for (const v of img) if (v > max) max = v
    const data = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const v = max > 0 ? Math.round((img[i] / max) * 235) + 20 : 20
      data.data[4 * i] = v * 0.55; data.data[4 * i + 1] = v * 0.8; data.data[4 * i + 2] = v; data.data[4 * i + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
  }, [img, size])
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      title={title}
      data-map={title}
      onClick={onClick}
      style={{ width: display, height: display, imageRendering: 'pixelated', borderRadius: 3, border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, cursor: onClick ? 'zoom-in' : 'default', background: '#141c2a', display: 'block' }}
    />
  )
}

export function LayerStrip({ model, tensors, probs }: { model: Model; tensors: Map<string, Tensor> | null; probs: Float32Array | null }) {
  const [enlarged, setEnlarged] = useState<{ title: string; img: Float32Array; size: number } | null>(null)
  if (!tensors) return <Note>Draw something to fill the strip.</Note>
  const input = tensors.get('input')!
  const columns: { title: string; size: string; maps: { img: Float32Array; size: number; title: string }[] }[] = []
  columns.push({ title: 'input', size: `${input.h} × ${input.w}`, maps: [{ img: channel(input, 0), size: input.h, title: 'input' }] })
  for (const layer of model.desc.layers ?? []) {
    const conv = tensors.get(layer.id)!
    const pooled = tensors.get(layer.pooled)!
    columns.push({ title: `${layer.title}: convolution`, size: `${conv.c} maps, ${conv.h} × ${conv.w}`, maps: Array.from({ length: CHANNELS_SHOWN }, (_, i) => ({ img: channel(conv, i), size: conv.h, title: `${layer.title} feature map ${i + 1}` })) })
    columns.push({ title: `${layer.title}: pooled`, size: `${pooled.c} maps, ${pooled.h} × ${pooled.w}`, maps: Array.from({ length: CHANNELS_SHOWN }, (_, i) => ({ img: channel(pooled, i), size: pooled.h, title: `${layer.title} pooled map ${i + 1}` })) })
  }
  const display = (size: number) => Math.max(14, Math.min(64, Math.round(64 * Math.sqrt(size / 64))))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-layer-strip>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 4 }}>
        {columns.map((col) => (
          <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', flex: '0 0 auto' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{col.title}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{col.size}</div>
            <div style={{ display: 'grid', gridTemplateColumns: col.maps.length > 1 ? '1fr 1fr' : '1fr', gap: 3 }}>
              {col.maps.map((m) => (
                <MapCanvas key={m.title} img={m.img} size={m.size} display={display(m.size)} title={m.title} selected={enlarged?.title === m.title} onClick={() => setEnlarged(m)} />
              ))}
            </div>
            {col.maps.length > 1 && <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>8 of {col.size.split(' ')[0]}</div>}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 auto' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>output</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>{model.desc.labels.length} labels</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {model.desc.labels.map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5 }}>
                <span style={{ width: 64, textAlign: 'right', color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ display: 'inline-block', width: Math.max(1, Math.round((probs?.[i] ?? 0) * 60)), height: 6, background: 'var(--accent)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {enlarged && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} data-enlarged={enlarged.title}>
          <MapCanvas img={enlarged.img} size={enlarged.size} display={192} title={`${enlarged.title}, enlarged`} />
          <Note>
            <b>{enlarged.title}</b>, {enlarged.size} × {enlarged.size}. Brighter is a stronger response. Click any map to enlarge it here.
          </Note>
        </div>
      )}
    </div>
  )
}
