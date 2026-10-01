export type Vec3 = [number, number, number]

export interface FlightTelemetry {
  speed: number
  altitude: number
  stamina: number
  boosting: boolean
}

export interface RingDef {
  id: number
  position: Vec3
  yaw: number
}
