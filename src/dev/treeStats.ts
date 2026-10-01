import { Tree } from '@dgreenheck/ez-tree'
export function treeStats() {
  const out: Record<string, number[]> = {}
  for (const name of ['Pine Small', 'Pine Medium', 'Pine Large', 'Oak Medium', 'Aspen Medium', 'Ash Medium', 'Bush 1', 'Bush 2']) {
    const t = new Tree()
    t.loadPreset(name)
    t.generate()
    t.branchesMesh.geometry.computeBoundingBox()
    const bb = t.branchesMesh.geometry.boundingBox!
    out[name] = [t.branchesMesh.geometry.index!.count / 3, t.leavesMesh.geometry.index!.count / 3, Math.round(bb.max.y - bb.min.y)]
  }
  return out
}
