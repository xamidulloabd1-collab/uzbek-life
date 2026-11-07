export interface Vec2 {
  x: number;
  z: number;
}

export type BodyType = 'sedan' | 'hatch' | 'van' | 'crossover' | 'suv';

export interface VehiclePerf {
  maxSpeedKmh: number;
  /** launch acceleration, m/s² */
  accel: number;
  /** braking deceleration, m/s² */
  brake: number;
  /** max front wheel angle, rad */
  steerAngle: number;
  /** how fast the wheel turns, rad/s */
  steerSpeed: number;
  mass: number;
  /** tyre friction coefficient */
  grip: number;
  /** 0..1, visual body roll / pitch softness */
  suspension: number;
  fuelCapacity: number;
  /** litres per 100 km */
  consumption: number;
}

export interface VehicleDims {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  clearance: number;
}

export interface VehicleShape {
  /** absolute beltline height (m) */
  belt: number;
  hood: number;
  trunk: number;
  /** horizontal run of the windshield */
  wsRun: number;
  /** horizontal run of the rear window */
  rwRun: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  niche: string;
  description: string;
  body: BodyType;
  price: number;
  seats: number;
  perf: VehiclePerf;
  dims: VehicleDims;
  shape: VehicleShape;
  defaultColor: string;
  /** taxi fare multiplier */
  fareFactor: number;
  /** catalog fields (vehicles added from public/assets/vehicles) */
  category?: VehicleCategory;
  modelUrl?: string;
  rotateY?: number;
  /** relative spawn weight in traffic */
  weight?: number;
  license?: { title: string; author: string; license: string; source: string; downloaded?: string; modifications?: string };
}

export type VehicleCategory = 'sedan' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'truck' | 'bus' | 'service' | 'emergency' | 'sports' | 'classic';

export interface VehicleCustom {
  color: string;
  wheels: number;
  tint: number;
  plate: string;
  engine: number;
  handling: number;
}

export interface OwnedVehicle extends VehicleCustom {
  uid: string;
  specId: string;
  /** 0..100 */
  health: number;
  /** litres */
  fuel: number;
}

export interface Transaction {
  id: string;
  day: number;
  minutes: number;
  amount: number;
  label: string;
}

export type PropertyType = 'apartment' | 'house' | 'luxury' | 'commercial' | 'garage';

export interface PropertyDef {
  id: string;
  name: string;
  type: PropertyType;
  price: number;
  /** so'm per game day (commercial only) */
  income: number;
  block: [number, number];
  side: Side;
  description: string;
  hasGarage: boolean;
}

export type Side = 'n' | 's' | 'e' | 'w';

export type PanelId =
  | null
  | 'pause'
  | 'map'
  | 'garage'
  | 'dealership'
  | 'jobs'
  | 'properties'
  | 'bank'
  | 'inventory'
  | 'settings'
  | 'phone'
  | 'credits'
  | 'assets';

export type QualityPreset = 'mobile-low' | 'mobile-medium' | 'mobile-high' | 'low' | 'medium' | 'high' | 'ultra';

export interface Settings {
  preset: QualityPreset;
  resolutionScale: number;
  /** 0 off, 1 low, 2 medium, 3 high */
  shadows: number;
  renderDistance: number;
  antialias: boolean;
  showFps: boolean;
  trafficDensity: number;
  pedestrianDensity: number;
  mouseSensitivity: number;
  invertY: boolean;
  volume: number;
  dynamicResolution: boolean;
  touchButtonScale: number;
  /** step the preset down automatically when FPS stays low */
  autoQuality: boolean;
}

export type StepKind = 'pickup' | 'dropoff' | 'work';

export interface MissionStep {
  label: string;
  pos: Vec2;
  radius: number;
  kind: StepKind;
  /** seconds the player must stay inside the zone */
  hold: number;
  requireVehicle?: boolean;
  requireOnFoot?: boolean;
  /** cargo item added/removed when the step finishes */
  giveItem?: string;
  takeItem?: string;
  /** optional prop shown at the step location */
  prop?: 'brokenCar';
}

export interface ActiveMission {
  jobId: string;
  title: string;
  steps: MissionStep[];
  stepIndex: number;
  reward: number;
  startedAt: number;
  progress: number;
}

export interface CargoItem {
  id: string;
  name: string;
  qty: number;
}

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'fog';

export interface Notification {
  id: string;
  text: string;
  kind: 'info' | 'good' | 'bad';
  at: number;
}

export interface HudState {
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  gear: string;
  rpm: number;
  fuel: number;
  fuelMax: number;
  health: number;
  prompt: string | null;
  district: string;
  activity: string;
  fps: number;
  missionDistance: number | null;
  missionHold: number;
  missionArrow: number | null;
  waypointDistance: number | null;
  interaction: string | null;
  vehicleAction: string | null;
  /** 'Sizniki' | 'Begona · vaqtincha' … */
  vehicleOwner: string;
  lights: string;
  signal: string;
  engineOn: boolean;
  /** lock mini-game for locked NPC cars */
  minigame: { needle: number; zone: [number, number]; tries: number } | null;
}

export interface DeviceInfo {
  touch: boolean;
  mobile: boolean;
  tier: 'low' | 'mid' | 'high';
  gpu: string;
}
