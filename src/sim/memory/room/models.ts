/**
 * The shipped model file for each thing the room shows, by its id in
 * `public/m10/room/manifest.json`. Copied here rather than imported from
 * the public folder, which the bundler must not read; `room.test.ts` holds
 * this table to the manifest.
 */
export const MODEL_FILES: Record<string, string> = {
  'bed': 'kenney-furniture/bed.glb',
  'bed-pillow': 'kenney-furniture/bed-pillow.glb',
  'desk': 'kenney-furniture/desk.glb',
  'desk-chair': 'kenney-furniture/desk-chair.glb',
  'bookshelf': 'kenney-furniture/bookshelf.glb',
  'wardrobe': 'kenney-furniture/wardrobe.glb',
  'window-wall': 'kenney-furniture/window-wall.glb',
  'door': 'kenney-furniture/door.glb',
  'rug': 'kenney-furniture/rug.glb',
  'nightstand': 'kenney-furniture/nightstand.glb',
  'ceiling-fan': 'kenney-furniture/ceiling-fan.glb',
  'desk-lamp': 'kenney-furniture/desk-lamp.glb',
  'mini-fridge': 'kenney-furniture/mini-fridge.glb',
  'coffee-mug': 'kenney-food/coffee-mug.glb',
  'water-bottle': 'kenney-survival/water-bottle.glb',
  'textbooks': 'kenney-furniture/textbooks.glb',
  'trash-can': 'kenney-furniture/trash-can.glb',
  'potted-plant': 'kenney-furniture/potted-plant.glb',
  'speaker': 'kenney-furniture/speaker.glb',
  'pizza-box': 'kenney-food/pizza-box.glb',
  'microwave': 'kenney-furniture/microwave.glb',
  'monitor': 'kenney-furniture/monitor.glb',
  'toaster': 'kenney-furniture/toaster.glb',
  'hay-bale': 'kenney-graveyard/hay-bale.glb',
  'garden-trowel': 'polyhaven/garden-trowel.glb',
  'axe': 'kenney-survival/axe.glb',
  'candelabra': 'kenney-graveyard/candelabra.glb',
  'lantern': 'kenney-graveyard/lantern.glb',
  'anvil': 'kenney-survival/anvil.glb',
  'pickaxe': 'kenney-survival/pickaxe.glb',
  'sled': 'kenney-holiday/sled.glb',
  'urn': 'kenney-graveyard/urn.glb',
  'hoe': 'kenney-survival/hoe.glb',
  'frying-pan': 'kenney-food/frying-pan.glb',
  'bucket': 'kenney-survival/bucket.glb',
}

export function modelFile(id: string): string {
  const f = MODEL_FILES[id]
  if (!f) throw new Error(`no model for ${id}`)
  return f
}
