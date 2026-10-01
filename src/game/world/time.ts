import * as THREE from 'three'

/** World clock. t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
export const worldTime = {
  t: 0.3,
  /** real seconds for a full day */
  dayLength: 600,
}

const sun = new THREE.Vector3()

export function sunDirection(t = worldTime.t, out = sun) {
  const angle = (t - 0.25) * Math.PI * 2
  // the sun arcs from east to west, tilted south
  return out.set(Math.cos(angle), Math.sin(angle), -0.35).normalize()
}

/** 0 at night, 1 in full day, smooth through dawn/dusk. */
export function daylight(t = worldTime.t) {
  const elevation = Math.sin((t - 0.25) * Math.PI * 2)
  return THREE.MathUtils.smoothstep(elevation, -0.12, 0.25)
}

export function clockLabel(t = worldTime.t) {
  const minutes = Math.floor(t * 24 * 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`
}
